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
}

export const DEFAULT_DIAGRAM_OPTIONS: DiagramOptions = {
  sql: 'statement',
  httpBodies: false,
};

const SQL_ALIASES: Record<string, SqlDetail> = {
  off: 'off', none: 'off', no: 'off', '0': 'off', false: 'off',
  statement: 'statement', on: 'statement', '1': 'statement', true: 'statement', yes: 'statement',
  values: 'values', value: 'values', params: 'values', parameters: 'values', full: 'values',
};

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
  };
}

/** The line a generated file carries so its own detail level is never a guess. */
export function describeOptions(o: DiagramOptions): string {
  const sql = {off: 'not shown', statement: 'shown, values as ?', values: 'shown, with values'}[o.sql];
  return `SQL ${sql} · HTTP bodies ${o.httpBodies ? 'shown' : 'not shown'}`;
}
