// A DB span's name is a generic "SELECT petclinic.owners" — true of every query
// the repository fires. What tells the reader *which* query ran comes in two
// grains: Hibernate's own account of what it was doing (the HQL, or the entity
// role it was lazily loading), and the SQL that account compiled down to. The
// first is short enough to label an arrow with; the second is folded one clause
// per line and clipped so a 40-column Hibernate select cannot swallow the page.

import {capLines, ELLIPSIS} from './clip';

const CLAUSE_KEYWORDS = [
  'select', 'from', 'where', 'group by', 'having', 'order by', 'limit', 'offset',
  'fetch first', 'fetch next', 'for update', 'union all', 'union', 'intersect', 'except',
  'inner join', 'left outer join', 'right outer join', 'full outer join',
  'left join', 'right join', 'full join', 'cross join', 'join', 'on conflict', 'on',
  'insert into', 'values', 'update', 'set', 'delete from', 'returning',
];

// Sticky + longest-first: it must match *at* a given position, and "left outer join"
// has to win over "join" — JS alternation takes the first branch that matches, not
// the longest one.
const CLAUSE_AT = new RegExp(
  `(?:${[...CLAUSE_KEYWORDS].sort((a, b) => b.length - a.length).join('|')})\\b`,
  'iy',
);

const WORD = /\w/;
const MAX_WORDS_PER_LINE = 10;
const MAX_LINES = 8;

/** Index just past the single-quoted literal starting at `start` ('' being an escaped quote). */
function endOfLiteral(sql: string, start: number): number {
  for (let i = start + 1; i < sql.length; i++) {
    if (sql[i] !== "'") continue;
    if (sql[i + 1] === "'") {
      i++;
      continue;
    }
    return i + 1;
  }
  return sql.length; // unterminated (a body the agent truncated) — take the rest
}

/**
 * Applies `transform` to the SQL *grammar* only, leaving string literals verbatim.
 * The statement sanitizer is deliberately off in this project (it is what would
 * otherwise rewrite bound values to `?`), so real literals do reach this code.
 */
function overCode(sql: string, transform: (code: string) => string): string {
  let out = '';
  let last = 0;
  for (let i = 0; i < sql.length; i++) {
    if (sql[i] !== "'") continue;
    const end = endOfLiteral(sql, i);
    out += transform(sql.slice(last, i)) + sql.slice(i, end);
    last = end;
    i = end - 1;
  }
  return out + transform(sql.slice(last));
}

/**
 * One line per clause — but only clauses of the statement being read. A keyword
 * inside parentheses belongs to a subquery (`@Formula` petCount is one), and
 * breaking there detaches the outer columns that follow the closing paren, which
 * then read as part of the subquery's WHERE.
 */
function foldClauses(sql: string): string[] {
  const lines: string[] = [];
  let current = '';
  let depth = 0;
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i];

    if (ch === "'") {
      const end = endOfLiteral(sql, i);
      current += sql.slice(i, end);
      i = end;
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);

    const atWordStart = i === 0 || !WORD.test(sql[i - 1]);
    if (depth === 0 && atWordStart) {
      CLAUSE_AT.lastIndex = i;
      const keyword = CLAUSE_AT.exec(sql)?.[0];
      if (keyword) {
        if (current.trim()) lines.push(current.trim());
        current = keyword.toUpperCase();
        i += keyword.length;
        continue;
      }
    }

    current += ch;
    i++;
  }

  if (current.trim()) lines.push(current.trim());
  return lines;
}

function clipWords(line: string): string {
  const words = line.split(' ');
  if (words.length <= MAX_WORDS_PER_LINE) return line;
  return [...words.slice(0, MAX_WORDS_PER_LINE), ELLIPSIS].join(' ');
}

// `hibernate.use_sql_comments` (see the backend's application.properties) makes
// Hibernate prefix every statement it generates with what produced it — the HQL for
// a query, `load com.example.Owner.pets` for a lazy collection fetch. The OTel agent
// has no HQL of its own, so this comment is the only place a trace says which
// repository call a bare `select ... from owners` came from.
const LEADING_COMMENT = /^\s*\/\*([\s\S]*?)\*\/\s*/;
const MAX_ORIGIN_WORDS = 14;

/**
 * Hibernate's account of the statement, and the statement itself. The comment is
 * not SQL and never belongs inside the folded clauses; it is what the arrow is
 * labelled with, while the statement stays behind the click.
 */
export function splitOrigin(sql: string): {origin?: string; statement: string} {
  let rest = sql;
  const comments: string[] = [];
  for (let m = LEADING_COMMENT.exec(rest); m; m = LEADING_COMMENT.exec(rest)) {
    comments.push(m[1]);
    rest = rest.slice(m[0].length);
  }
  const origin = comments.join(' ').replace(/\s+/g, ' ').trim();
  return origin ? {origin, statement: rest} : {statement: rest};
}

/** Hibernate's account of a statement, on one line, short enough to label an arrow. */
export function formatOriginLabel(origin: string): string {
  const words = origin.split(' ');
  if (words.length <= MAX_ORIGIN_WORDS) return origin;
  return [...words.slice(0, MAX_ORIGIN_WORDS), ELLIPSIS].join(' ');
}

// The last thing a DB arrow can be called. `SELECT petclinic` — the OTel span name — is
// the operation plus the *database*, so every query in the trace shares it; the verb plus
// the table it actually reads is the smallest description that tells two apart, which is
// the whole job when twenty of them are an N+1.
const STATEMENT_SHAPES: Array<[RegExp, string]> = [
  [/^\s*select\b[\s\S]*?\bfrom\s+([\w."]+)/i, 'select'],
  [/^\s*insert\s+into\s+([\w."]+)/i, 'insert into'],
  [/^\s*update\s+([\w."]+)/i, 'update'],
  [/^\s*delete\s+from\s+([\w."]+)/i, 'delete from'],
];

/** `select pets` for a statement that reads pets — or nothing, for SQL of no known shape. */
export function summarizeStatement(sql: string): string | undefined {
  const {statement} = splitOrigin(sql);
  for (const [shape, verb] of STATEMENT_SHAPES) {
    const m = shape.exec(statement);
    // the schema prefix is the same for every table here, so it separates nothing
    if (m) return `${verb} ${m[1].replace(/"/g, '').split('.').pop()}`;
  }
  return undefined;
}

function foldStatement(sql: string, parameters: string[]): string[] {
  // Hibernate emits comma-packed column lists; without a space they read as one
  // enormous "word" and the word clip below could never bite.
  const {statement} = splitOrigin(sql);
  const spaced = overCode(statement.replace(/\s+/g, ' ').trim(), (code) => code.replace(/\s*,\s*/g, ', '));

  // Values go in *after* the fold on purpose: a description reading "Follow up on
  // the vaccination" would otherwise be folded at its own ON.
  return bindParameters(foldClauses(spaced), parameters);
}

/** The statement folded into display lines: one clause each, clipped in both directions. */
export function formatSqlLines(sql: string, parameters: string[] = []): string[] {
  return capLines(foldStatement(sql, parameters).map(clipWords), MAX_LINES);
}

/**
 * The same fold, uncapped — for the panel a reader clicks open, which scrolls.
 * A clip is what a *label* needs, because a 40-column select would swallow the
 * page; a panel opened on purpose should show the statement that actually ran.
 */
export function formatSqlDetail(sql: string, parameters: string[] = []): string {
  return foldStatement(sql, parameters).join('\n');
}

/** The same, as a PlantUML message label — `\n` is PlantUML's own line break. */
export function formatSqlLabel(sql: string, parameters: string[] = []): string {
  // a backslash already in the SQL (Hibernate's `escape '\'`) would otherwise eat
  // the separator that follows it
  return formatSqlLines(sql, parameters).map((l) => l.replace(/\\/g, '\\\\')).join('\\n');
}

// A prepared statement travels as `?` placeholders with the values bound alongside;
// the agent captures them separately (db.query.parameter.N). Putting them back turns
// "which query ran" into "which query ran, on what".
function bindParameters(lines: string[], parameters: string[]): string[] {
  if (parameters.length === 0) return lines;
  let next = 0;
  return lines.map((line) => overCode(line, (code) => code.replace(/\?/g, (placeholder) =>
    (next < parameters.length ? quoteValue(parameters[next++]) : placeholder))));
}

/** Numbers, NULL and booleans as they are; anything else quoted, so the line stays real SQL. */
function quoteValue(value: string): string {
  const v = value.trim();
  if (/^(-?\d+(\.\d+)?|null|true|false)$/i.test(v)) return v;
  return `'${value.replace(/'/g, "''")}'`;
}

/** Exported for the tests: substitution over a statement that has not been folded. */
export function applyParameters(sql: string, parameters: string[]): string {
  return bindParameters([sql], parameters)[0];
}
