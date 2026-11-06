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
 * the top application frame is the component's `.subscribe(`.
 */

/** Where a browser CLIENT span keeps its frames, as JSON — so a replay of the span cache has them. */
export const CALL_SITE_ATTRIBUTE = 'genseq.call-site';

/** One application frame of a request's stack, in the original source. */
export interface CallFrame {
  /** Relative to the frontend module: `src/app/owners/owner.service.ts`. */
  file: string;
  line: number;
  /** That line of the source the bundle was built from, to confirm against the checkout. */
  text?: string;
}

/** One request, identified the way its spans are: the header it left the page with. */
export interface CallSite {
  traceId: string;
  spanId: string;
  frames: CallFrame[];
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

// Code that passes a request along. Above a component on the stack (a service that subscribes
// on the component's behalf), it says how the request travelled, not what started it.
const PASS_THROUGH = /\.(?:service|interceptor)\.ts$/;

/**
 * The frame an arrow links to: the application frame nearest what started the request.
 * Usually the first frame there is; a service above a component yields to the component.
 */
export function triggerOf(frames: CallFrame[]): CallFrame | undefined {
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

/** Every recorded request, by the span it left the browser under. */
export function callSiteIndex(sites: CallSite[]): Map<string, CallFrame[]> {
  return new Map(sites.map((site) => [joinKey(site), site.frames]));
}

/**
 * Stamps each browser CLIENT span with the frames of the request it made.
 *
 * On the span rather than beside it, so the span cache carries them: a re-render replays that
 * file with nothing running, long after the recordings and the source maps are gone.
 */
export function withCallSites(spans: NormSpan[], index: Map<string, CallFrame[]>): NormSpan[] {
  return spans.map((span) => {
    const frames = span.kind === 'CLIENT' ? index.get(joinKey(span)) : undefined;
    if (!frames?.length) return span;
    return {...span, attributes: {...span.attributes, [CALL_SITE_ATTRIBUTE]: JSON.stringify(frames)}};
  });
}
