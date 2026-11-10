import {Page} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import {SourceMapConsumer} from 'source-map';
import {CallSite, idsOfTraceparent, parseStack, replayableHeaders, requestFrames} from '../genseq/call-site';
import {TestWindow} from '../genseq/generate';
import {windowFileName} from './trace-window-store';

/**
 * One request as it left the page: the W3C header it carried, then the JS stacks that explain
 * it. Its own stack first, then the stack that scheduled each task it ran in, nearest first.
 */
export interface RawCallSite {
  traceparent: string;
  stacks: string[];
  /** Every header the page set on the request, the trace context included. */
  headers?: Record<string, string>;
}

const BINDING = '__genseqCallSite';

/** Enough for a router hop and a timer or two; a timer rearming itself must not chain for ever. */
const MAX_CAUSES = 16;

/**
 * Runs in the page before any of its scripts. Serialized by Playwright, so it may only touch
 * what it is handed and the browser's own globals.
 *
 * Installed first means wrapped last: zone.js and the OTel instrumentation both patch these
 * same methods on top of this one, so by the time a request reaches `send` here OTel has
 * already called `setRequestHeader('traceparent', …)` — and the stack still has everybody
 * above it, down to the line of application code that started the call.
 *
 * Unless that code has already returned. `router.navigate` hops over a `Promise.resolve` in
 * the router, so the request of a sort or a page change leaves from a stack of 226 frames with
 * no application frame on it. V8's async stacks cannot help: zone.js drains its own microtask
 * queue at the end of the click, so to V8 it is one synchronous task (measured with
 * Debugger.setAsyncCallStackDepth: no async parent at all). The hop is only visible to Zone,
 * which is why the stack is also taken wherever Zone schedules a task. An Error is cheap until
 * its `.stack` is read, which happens only for a task a request ran in.
 *
 * Every header the page sets is taken on the way too: nothing else records them, and the
 * request's detail panel shows them and replays the call with them (Victor, 10 Nov 2026).
 * Taken here whole and filtered in Node (`replayableHeaders`), which a unit test can reach.
 */
function wrapRequestSenders({binding, maxCauses}: {binding: string; maxCauses: number}): void {
  const page = globalThis as any;
  // The default of 10 frames ends inside rxjs: a subscribe chain alone is deeper than that.
  page.Error.stackTraceLimit = Infinity;

  interface Cause {error: Error; up: Cause | null; depth: number}
  const causes = new WeakMap<object, Cause>();
  let running: Cause | null = null;

  // A click is not caused by the code that registered its listener, so an event task has no
  // cause and starts a chain of its own. Zone is trapped on its way in: it has to be hooked
  // after polyfills.js defines it and before the app starts scheduling.
  const followTasks = (Zone: any): void => {
    const {scheduleTask, runTask} = Zone.prototype;
    Zone.prototype.scheduleTask = function (this: object, task: any) {
      if (task.type !== 'eventTask') {
        const depth = (running?.depth ?? 0) + 1;
        causes.set(task, {error: new page.Error(), up: depth < maxCauses ? running : null, depth});
      }
      return scheduleTask.call(this, task);
    };
    Zone.prototype.runTask = function (this: object, task: object, ...args: unknown[]) {
      const outer = running;
      running = causes.get(task) ?? null;
      try {
        return runTask.call(this, task, ...args);
      } finally {
        running = outer;
      }
    };
  };
  let zone: unknown;
  Object.defineProperty(page, 'Zone', {
    configurable: true,
    get: () => zone,
    set: (value) => {
      zone = value;
      followTasks(value);
    },
  });

  // From the root zone, or the promise the binding returns would count as Angular work and
  // the app would run an extra change detection for every request it made under test.
  const report = (traceparent: string, headers: Record<string, string>): void => {
    const stacks = [new page.Error().stack ?? ''];
    for (let cause = running; cause; cause = cause.up) stacks.push(cause.error.stack ?? '');
    const send = () => page[binding](traceparent, stacks, headers);
    page.Zone?.root ? page.Zone.root.run(send) : send();
  };
  const traceparentOf = (headers: Record<string, string>): string | undefined =>
    Object.entries(headers).find(([name]) => name.toLowerCase() === 'traceparent')?.[1];

  const proto = page.XMLHttpRequest.prototype;
  const sent = new WeakMap<object, Record<string, string>>();
  // `open` starts a new request on the same object, and the spec drops its headers there too.
  const open = proto.open;
  proto.open = function (this: object, ...args: unknown[]) {
    sent.delete(this);
    return open.apply(this, args);
  };
  const setRequestHeader = proto.setRequestHeader;
  proto.setRequestHeader = function (this: object, name: string, value: string) {
    const headers = sent.get(this) ?? {};
    // A header set twice goes out once, its values joined — the way the browser sends it.
    headers[name] = Object.hasOwn(headers, name) ? `${headers[name]}, ${value}` : String(value);
    sent.set(this, headers);
    return setRequestHeader.call(this, name, value);
  };
  const send = proto.send;
  proto.send = function (this: object, ...args: unknown[]) {
    const headers = sent.get(this) ?? {};
    const traceparent = traceparentOf(headers);
    if (traceparent) report(traceparent, headers);
    return send.apply(this, args);
  };

  const fetch = page.fetch;
  page.fetch = function (this: unknown, input: any, init?: any) {
    const headers: Record<string, string> = {};
    new page.Headers(init?.headers ?? input?.headers ?? {})
      .forEach((value: string, name: string) => {headers[name] = value;});
    const traceparent = traceparentOf(headers);
    if (traceparent) report(traceparent, headers);
    return fetch.call(this, input, init);
  };
}

/**
 * From now on, every traced request this page sends is remembered with the stacks that sent
 * it. A binding rather than an array on `window`: the array would die with the first full
 * navigation, and a test may make several.
 */
export async function recordCallSites(page: Page): Promise<RawCallSite[]> {
  const sites: RawCallSite[] = [];
  await page.exposeFunction(BINDING, (traceparent: string, stacks: string[], headers?: Record<string, string>) => {
    sites.push({traceparent, stacks, ...(headers ? {headers} : {})});
  });
  await page.addInitScript(wrapRequestSenders, {binding: BINDING, maxCauses: MAX_CAUSES});
  return sites;
}

// Parsed once per process: one bundle's map is 7 MB and every test's stacks point into it.
const maps = new Map<string, Promise<SourceMapConsumer | undefined>>();

/**
 * The map beside a script, over HTTP from the server that served it. The Docker build keeps
 * its maps `hidden`, which only drops the `sourceMappingURL` comment: nginx serves
 * `main.<hash>.js.map` next to the bundle, and `ng serve` does the same for `main.js`.
 */
function mapOf(script: string): Promise<SourceMapConsumer | undefined> {
  let map = maps.get(script);
  if (!map) {
    map = fetch(`${script}.map`)
      .then((response) => (response.ok ? response.json() : undefined))
      .then((raw) => (raw ? new SourceMapConsumer(raw) : undefined))
      .catch(() => undefined);
    maps.set(script, map);
  }
  return map;
}

async function toCallSites(sites: RawCallSite[]): Promise<CallSite[]> {
  const stacks = sites.flatMap((s) => s.stacks);
  const scripts = [...new Set(stacks.flatMap((stack) => parseStack(stack).map((f) => f.url)))];
  const loaded = new Map<string, SourceMapConsumer>();
  for (const script of scripts) {
    const map = await mapOf(script);
    if (map) loaded.set(script, map);
  }
  return sites.flatMap((site) => {
    const ids = idsOfTraceparent(site.traceparent);
    const headers = replayableHeaders(site.headers);
    return ids ? [{...ids, frames: requestFrames(site.stacks, loaded), ...(headers ? {headers} : {})}] : [];
  });
}

/** A test's requests on disk. `source` is what `forgetWindowsOf` sorts files to their runner by. */
type CallSiteFile = Pick<TestWindow, 'title' | 'source'> & {sites: CallSite[]};

function readFileOf(file: string): CallSite[] {
  try {
    return (JSON.parse(fs.readFileSync(file, 'utf-8')) as CallSiteFile).sites ?? [];
  } catch {
    return []; // not there yet, or a run killed mid-write: that test's links, not every diagram's
  }
}

/**
 * One file per test, named as its trace window is, and added to: every row of a Scenario
 * Outline runs under the same title. A runner clears its own at the start, with
 * `forgetWindowsOf`, and only its own: the last diagram step of a review re-fetches both
 * suites, and needs both suites' files.
 *
 * Translated here, while the stack that served the bundle is certainly still up. Best-effort,
 * like the diagram it feeds: a request with no call site is an arrow with no link, never a
 * red test.
 */
export async function saveCallSites(
  dir: string, test: Pick<TestWindow, 'title' | 'source'>, sites: RawCallSite[],
): Promise<void> {
  try {
    const translated = await toCallSites(sites);
    fs.mkdirSync(dir, {recursive: true});
    const file = path.join(dir, windowFileName(test));
    const entry: CallSiteFile = {...test, sites: [...readFileOf(file), ...translated]};
    fs.writeFileSync(file, JSON.stringify(entry, null, 2));
  } catch (err) {
    console.warn(`⚠️  Could not save the call sites of "${test.title}": ${(err as Error).message}`);
  }
}

/** Every request on file. */
export function readCallSites(dir: string): CallSite[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => name.endsWith('.json'))
    .flatMap((name) => readFileOf(path.join(dir, name)));
}
