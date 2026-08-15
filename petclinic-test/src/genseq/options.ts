// How much of what the traces carry ends up on the diagram. The traces always
// carry everything (the backend agent captures SQL + bound parameters, the
// browser captures the HTTP payloads); these switches only decide what is drawn,
// so changing your mind is a re-render of the last run, never another test run.

/** `off` — no SQL; `statement` — the SQL as sent, `?` for each bound value; `values` — `?` filled in. */
export type SqlDetail = 'off' | 'statement' | 'values';

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
}

export const DEFAULT_DIAGRAM_OPTIONS: DiagramOptions = {
  sql: 'statement',
  httpBodies: false,
  interactive: true,
};

// Object.create(null): a plain literal answers to `constructor` and `__proto__`,
// which would sail past the fallback below and put `SQL undefined` in the header.
const SQL_ALIASES: Record<string, SqlDetail> = Object.assign(Object.create(null), {
  off: 'off', '0': 'off', false: 'off',
  statement: 'statement', '1': 'statement', true: 'statement',
  values: 'values', params: 'values',
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
  return {
    sql: SQL_ALIASES[env.SEQ_SQL?.trim().toLowerCase() ?? ''] ?? DEFAULT_DIAGRAM_OPTIONS.sql,
    httpBodies: boolFrom(env.SEQ_HTTP_BODIES, DEFAULT_DIAGRAM_OPTIONS.httpBodies),
    interactive: boolFrom(env.SEQ_INTERACTIVE, DEFAULT_DIAGRAM_OPTIONS.interactive),
  };
}

/** What an interactive diagram lets the reader click open, in the order it appears. */
export function revealable(o: DiagramOptions): string[] {
  const kinds: string[] = [];
  if (o.sql !== 'off') kinds.push('SQL');
  if (o.httpBodies) kinds.push('JSON payloads');
  return kinds;
}

/** The line a generated file carries so its own detail level is never a guess. */
export function describeOptions(o: DiagramOptions): string {
  if (o.interactive) {
    const kinds = revealable(o);
    if (kinds.length === 0) return 'simplified · nothing recorded to reveal';
    return `simplified · click an arrow to reveal its ${kinds.join(' / ')}`;
  }
  const sql = {off: 'not shown', statement: 'shown, values as ?', values: 'shown, with values'}[o.sql];
  return `SQL ${sql} · HTTP bodies ${o.httpBodies ? 'shown' : 'not shown'}`;
}
