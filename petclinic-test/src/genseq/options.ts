// How much of what the traces carry ends up on the diagram. The traces always
// carry everything (the backend agent captures SQL + bound parameters, the
// browser captures the HTTP payloads); these switches only decide what is drawn,
// so changing your mind is a re-render of the last run, never another test run.

/** `off` — no SQL; `statement` — the SQL as sent, `?` for each bound value; `values` — `?` filled in. */
export type SqlDetail = 'off' | 'statement' | 'values';

/**
 * Where an HTTP arrow names the controller method its request landed on: `line` — a third line
 * of the arrow's label, a link of its own under the words that open the request; `call` — a
 * self-call on the receiving lifeline, everything the request did nested inside it.
 */
export type HandlerPlacement = 'line' | 'call';

export interface DiagramOptions {
  sql: SqlDetail;
  /** Draw the JSON request/response payloads of each REST round-trip as notes. */
  httpBodies: boolean;
  /**
   * Keep the picture simplified and hang the detail off each arrow instead, to be
   * revealed a click at a time in review/review.html. `sql` and `httpBodies` still
   * say *what* the diagram carries; this says whether it is baked in or clicked open.
   */
  interactive: boolean;
  /**
   * The words of a request arrow open the request itself now, so the controller needs a
   * place of its own. Both shapes are kept so they can be compared on a real diagram before
   * one of them wins (Victor, 10 Nov 2026).
   */
  handler: HandlerPlacement;
}

/** The default diagram: simplified, with everything the traces carry a click away. */
export const DEFAULT_DIAGRAM_OPTIONS: DiagramOptions = {
  sql: 'statement',
  httpBodies: true,
  interactive: true,
  handler: 'line',
};

// Object.create(null): a plain literal answers to `constructor` and `__proto__`,
// which would sail past the fallback below and put `SQL undefined` in the header.
const SQL_ALIASES: Record<string, SqlDetail> = Object.assign(Object.create(null), {
  off: 'off', '0': 'off', false: 'off',
  statement: 'statement', '1': 'statement', true: 'statement',
  values: 'values', params: 'values',
});

// Object.create(null) for the reason SQL_ALIASES gives.
const HANDLER_ALIASES: Record<string, HandlerPlacement> = Object.assign(Object.create(null), {
  line: 'line', call: 'call',
});

const TRUTHY = /^(1|true|yes|on)$/i;
const FALSY = /^(0|false|no|off)$/i;

function boolFrom(raw: string | undefined, fallback: boolean): boolean {
  const v = raw?.trim() ?? '';
  if (TRUTHY.test(v)) return true;
  if (FALSY.test(v)) return false;
  return fallback;
}

export function optionsFromEnv(
  env: Record<string, string | undefined> = process.env,
): DiagramOptions {
  const interactive = boolFrom(env.SEQ_INTERACTIVE, DEFAULT_DIAGRAM_OPTIONS.interactive);
  return {
    sql: SQL_ALIASES[env.SEQ_SQL?.trim().toLowerCase() ?? ''] ?? DEFAULT_DIAGRAM_OPTIONS.sql,
    // Payloads default to *whether they cost anything to carry*. Baked into the picture
    // they are a wall of JSON, so a static diagram still has to ask for them; behind a
    // click they cost nothing at all, and withholding them only meant a reviewer clicked
    // a request arrow and found it had nothing to say.
    httpBodies: boolFrom(env.SEQ_HTTP_BODIES, interactive),
    interactive,
    handler: HANDLER_ALIASES[env.SEQ_HANDLER?.trim().toLowerCase() ?? '']
      ?? DEFAULT_DIAGRAM_OPTIONS.handler,
  };
}

/**
 * What an interactive diagram lets the reader click open, in the order it appears. An HTTP
 * request always opens — its URL and headers are there to show with no payload switched on.
 */
export function revealable(o: DiagramOptions): string[] {
  const kinds: string[] = [];
  if (o.sql !== 'off') kinds.push('SQL');
  kinds.push('HTTP requests');
  if (o.httpBodies) kinds.push('JSON payloads');
  return kinds;
}

const HANDLER_PLACES: Record<HandlerPlacement, string> = {
  line: 'controllers under their request',
  call: 'controllers as calls',
};

/** The line a generated file carries so its own detail level is never a guess. */
export function describeOptions(o: DiagramOptions): string {
  const handler = HANDLER_PLACES[o.handler];
  if (o.interactive) {
    return `simplified · click an arrow to reveal its ${revealable(o).join(' / ')} · ${handler}`;
  }
  const sql = {off: 'not shown', statement: 'shown, values as ?', values: 'shown, with values'}[o.sql];
  return `SQL ${sql} · HTTP bodies ${o.httpBodies ? 'shown' : 'not shown'} · ${handler}`;
}
