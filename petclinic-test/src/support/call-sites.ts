import {Page} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import {SourceMapConsumer} from 'source-map';
import {CallSite, applicationFrames, idsOfTraceparent, parseStack} from '../genseq/call-site';
import {TestWindow} from '../genseq/generate';
import {windowFileName} from './trace-window-store';

/** One request as it left the page: the W3C header it carried and the JS stack that sent it. */
export interface RawCallSite {
  traceparent: string;
  stack: string;
}

const BINDING = '__genseqCallSite';

/**
 * Runs in the page before any of its scripts. Serialized by Playwright, so it may only touch
 * what it is handed and the browser's own globals.
 *
 * Installed first means wrapped last: zone.js and the OTel instrumentation both patch these
 * same methods on top of this one, so by the time a request reaches `send` here OTel has
 * already called `setRequestHeader('traceparent', …)` — and the stack still has everybody
 * above it, down to the line of application code that started the call.
 */
function wrapRequestSenders(binding: string): void {
  const page = globalThis as any;
  // The default of 10 frames ends inside rxjs: a subscribe chain alone is deeper than that.
  page.Error.stackTraceLimit = Infinity;

  // From the root zone, or the promise the binding returns would count as Angular work and
  // the app would run an extra change detection for every request it made under test.
  const report = (traceparent: string, stack: string | undefined): void => {
    const send = () => page[binding](traceparent, stack ?? '');
    page.Zone?.root ? page.Zone.root.run(send) : send();
  };

  const proto = page.XMLHttpRequest.prototype;
  const parents = new WeakMap<object, string>();
  const setRequestHeader = proto.setRequestHeader;
  proto.setRequestHeader = function (this: object, name: string, value: string) {
    if (String(name).toLowerCase() === 'traceparent') parents.set(this, value);
    return setRequestHeader.call(this, name, value);
  };
  const send = proto.send;
  proto.send = function (this: object, ...args: unknown[]) {
    const traceparent = parents.get(this);
    if (traceparent) report(traceparent, new page.Error().stack);
    return send.apply(this, args);
  };

  const fetch = page.fetch;
  page.fetch = function (this: unknown, input: any, init?: any) {
    const headers = new page.Headers(init?.headers ?? input?.headers ?? {});
    const traceparent = headers.get('traceparent');
    if (traceparent) report(traceparent, new page.Error().stack);
    return fetch.call(this, input, init);
  };
}

/**
 * From now on, every traced request this page sends is remembered with the stack that sent
 * it. A binding rather than an array on `window`: the array would die with the first full
 * navigation, and a test may make several.
 */
export async function recordCallSites(page: Page): Promise<RawCallSite[]> {
  const sites: RawCallSite[] = [];
  await page.exposeFunction(BINDING, (traceparent: string, stack: string) => {
    sites.push({traceparent, stack});
  });
  await page.addInitScript(wrapRequestSenders, BINDING);
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
  const scripts = [...new Set(sites.flatMap((s) => parseStack(s.stack).map((f) => f.url)))];
  const loaded = new Map<string, SourceMapConsumer>();
  for (const script of scripts) {
    const map = await mapOf(script);
    if (map) loaded.set(script, map);
  }
  return sites.flatMap((site) => {
    const ids = idsOfTraceparent(site.traceparent);
    return ids ? [{...ids, frames: applicationFrames(site.stack, loaded)}] : [];
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
