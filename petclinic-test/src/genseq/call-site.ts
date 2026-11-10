import type {SourceMapConsumer} from 'source-map';
import type {NormSpan} from './trace-to-puml';
import type {ReadSource} from './code-location';

/**
 * Which line of the frontend sent this request, in this run.
 *
 * The same endpoint is called from several places, so scanning the source for a route would
 * be a guess the diagram then states as a fact. The answer is taken from the request itself:
 * `support/call-sites.ts` captures the JS stack at the moment each XHR or fetch leaves, keyed
 * by the `traceparent` it carries, and everything here turns that stack into a link.
 *
 * Measured on add-visit: the stack is 76–89 frames deep and the application frame sits around
 * the 48th, under rxjs, HttpClient, zone and OTel. `http.get` is a cold Observable, so the
 * service method has already returned: `OwnerService.getOwnerById` is never on the stack, and
 * the top application frame is the component's `.subscribe(`. A request the router deferred
 * has no application frame at all, and is explained by what scheduled it (`requestFrames`).
 */

/** Where a browser CLIENT span keeps its frames, as JSON — so a replay of the span cache has them. */
export const CALL_SITE_ATTRIBUTE = 'genseq.call-site';

/**
 * Where a browser CLIENT span keeps the headers its request was sent with, as a JSON object.
 * The browser instrumentation records none, and the request's detail panel shows them and
 * replays the call with them (Victor, 10 Nov 2026); on the span for the same reason as the frames.
 */
export const REQUEST_HEADERS_ATTRIBUTE = 'genseq.request-headers';

/** One application frame of a request's stack, in the original source. */
export interface CallFrame {
  /** Relative to the frontend module: `src/app/owners/owner.service.ts`. */
  file: string;
  line: number;
  /** That line of the source the bundle was built from, to confirm against the checkout. */
  text?: string;
  /** Not on the request's own stack: it comes from the code that scheduled the task it left in. */
  deferred?: boolean;
}

/** One request, identified the way its spans are: the header it left the page with. */
export interface CallSite {
  traceId: string;
  spanId: string;
  frames: CallFrame[];
  /** Every header the page set on the request, as it set them — less the per-run trace context. */
  headers?: Record<string, string>;
}

// The trace context is new on every request of every run: stored, it would repaint each
// diagram's sidecar on every run, and a replay sent with it would join a trace long closed.
const PER_RUN_HEADERS = new Set(['traceparent', 'tracestate', 'baggage']);

/** The headers worth keeping, or undefined when none are left. */
export function replayableHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
  const kept = Object.entries(headers ?? {}).filter(([name]) => !PER_RUN_HEADERS.has(name.toLowerCase()));
  return kept.length > 0 ? Object.fromEntries(kept) : undefined;
}

/** `00-<trace id>-<span id>-01` — the span id in it is the browser's CLIENT span. */
export function idsOfTraceparent(
  traceparent: string,
): Pick<CallSite, 'traceId' | 'spanId'> | undefined {
  const m = /^[0-9a-f]{2}-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/.exec(traceparent.trim());
  return m ? {traceId: m[1], spanId: m[2]} : undefined;
}

const HEX_ID = /^(?:[0-9a-f]{16}|[0-9a-f]{32})$/;

/** Tempo answers with base64 ids; a `traceparent` carries them in hex. */
function hexId(id: string): string {
  return HEX_ID.test(id) ? id : Buffer.from(id, 'base64').toString('hex');
}

/** The script positions of a V8 stack, top first. Frames in eval or the init script have none. */
export function parseStack(stack: string): Array<{url: string; line: number; column: number}> {
  const frames: Array<{url: string; line: number; column: number}> = [];
  for (const row of stack.split('\n')) {
    const m = /(https?:\/\/[^\s()]+):(\d+):(\d+)\)?\s*$/.exec(row);
    if (m) frames.push({url: m[1], line: Number(m[2]), column: Number(m[3])});
  }
  return frames;
}

// `webpack:///src/app/…` in a production bundle, `webpack:///./src/app/…` from `ng serve`.
// Anchored, because `webpack:///node_modules/some-lib/src/app/…` is somebody else's app.
const APPLICATION_SOURCE = /^(?:webpack:\/\/[^/]*\/)?(?:\.\/)?(src\/app\/[^?]+)/;

/**
 * The application's own frames of one stack, top first, in the original source. A script with
 * no map contributes nothing: no frame is better than a position in minified code.
 */
export function applicationFrames(
  stack: string, maps: ReadonlyMap<string, SourceMapConsumer>,
): CallFrame[] {
  const frames: CallFrame[] = [];
  for (const {url, line, column} of parseStack(stack)) {
    const map = maps.get(url);
    if (!map) continue;
    // A stack counts columns from 1, a source map from 0.
    const at = map.originalPositionFor({line, column: column - 1});
    const file = at.source ? APPLICATION_SOURCE.exec(at.source)?.[1] : undefined;
    if (!file || !at.source || !at.line) continue;
    const previous = frames[frames.length - 1];
    if (previous?.file === file && previous.line === at.line) continue;
    const text = map.sourceContentFor(at.source, true)?.split('\n')[at.line - 1]?.trim();
    frames.push({file, line: at.line, ...(text ? {text} : {})});
  }
  return frames;
}

/**
 * The frames that explain one request: its own stack's, or else those of the nearest stack
 * that scheduled the task it left in. Causes are a fallback, so a request that was sent from
 * application code is never told apart from it by something that happened earlier.
 */
export function requestFrames(
  stacks: string[], maps: ReadonlyMap<string, SourceMapConsumer>,
): CallFrame[] {
  for (const [hop, stack] of stacks.entries()) {
    const frames = applicationFrames(stack, maps);
    if (frames.length > 0) return hop === 0 ? frames : frames.map((f) => ({...f, deferred: true}));
  }
  return [];
}

// Code that passes a request along. Above a component on the stack (a service that subscribes
// on the component's behalf), it says how the request travelled, not what started it.
const PASS_THROUGH = /\.(?:service|interceptor)\.ts$/;

/**
 * The frame an arrow links to: the application frame nearest what started the request.
 * Usually the first frame there is; a service above a component yields to the component.
 *
 * A deferred request counts from the other end. Its first frame is whatever handed the work
 * over, often one helper every caller shares (`navigate()` behind both a sort and a page
 * change), and the deepest code frame is the handler the template called: `onSort`, `onPage`.
 */
export function triggerOf(frames: CallFrame[]): CallFrame | undefined {
  const code = (f: CallFrame) => !PASS_THROUGH.test(f.file) && !f.file.endsWith('.html');
  if (frames[0]?.deferred) return [...frames].reverse().find(code) ?? frames[0];
  return frames.find((f) => !PASS_THROUGH.test(f.file)) ?? frames[0];
}

const fileName = (frame: CallFrame) => `${frame.file.split('/').pop()}:${frame.line}`;

/** Each frame by file and line, not by function: a minified stack has no names worth showing. */
function callSiteTooltip(frames: CallFrame[]): string {
  return `{Click to open the line that sent this request: ${frames.map(fileName).join(' ← ')}}`;
}

function framesOf(attribute: string): CallFrame[] {
  try {
    return JSON.parse(attribute);
  } catch {
    return [];
  }
}

/**
 * A `src://` handle on the line that sent this request, or undefined when there is no telling.
 *
 * The line is confirmed against the checkout: the bundle may have been built from another
 * commit than the one the page is reviewing, and there the same number is a different line.
 * Better no link than one that lands on the wrong code.
 */
export function callSiteHandle(
  attribute: string, serviceName: string, repoRoot: string, readSource: ReadSource,
): string | undefined {
  const frames = framesOf(attribute);
  const trigger = triggerOf(frames);
  if (!trigger) return undefined;
  const relative = `${serviceName}/${trigger.file}`;
  const lines = readSource(`${repoRoot}/${relative}`)?.split('\n');
  const line = lines?.[trigger.line - 1];
  if (line === undefined) return undefined;
  if (trigger.text !== undefined && line.trim() !== trigger.text) return undefined;
  return `src://${relative}:${trigger.line}${callSiteTooltip(frames)}`;
}

/** Keyed the same way on both sides of the join, whatever spelling the ids arrived in. */
function joinKey(ids: Pick<CallSite, 'traceId' | 'spanId'>): string {
  return `${hexId(ids.traceId)}/${hexId(ids.spanId)}`;
}

/** What one recorded request adds to its span. */
export type RecordedSite = Pick<CallSite, 'frames' | 'headers'>;

/** Every recorded request, by the span it left the browser under. */
export function callSiteIndex(sites: CallSite[]): Map<string, RecordedSite> {
  return new Map(sites.map((site) => [joinKey(site), {frames: site.frames, headers: site.headers}]));
}

/**
 * Stamps each browser CLIENT span with the frames of the request it made, and its headers.
 *
 * On the span rather than beside it, so the span cache carries them: a re-render replays that
 * file with nothing running, long after the recordings and the source maps are gone.
 */
export function withCallSites(spans: NormSpan[], index: Map<string, RecordedSite>): NormSpan[] {
  return spans.map((span) => {
    const site = span.kind === 'CLIENT' ? index.get(joinKey(span)) : undefined;
    const headers = replayableHeaders(site?.headers);
    const stamped: Record<string, string> = {
      ...(site?.frames?.length ? {[CALL_SITE_ATTRIBUTE]: JSON.stringify(site.frames)} : {}),
      ...(headers ? {[REQUEST_HEADERS_ATTRIBUTE]: JSON.stringify(headers)} : {}),
    };
    if (Object.keys(stamped).length === 0) return span;
    return {...span, attributes: {...span.attributes, ...stamped}};
  });
}
