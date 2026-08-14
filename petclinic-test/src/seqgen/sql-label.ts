// A DB span's name is a generic "SELECT petclinic.owners" — true of every query
// the repository fires. The statement itself is what tells the reader *which*
// query ran, so the diagram carries the SQL, folded one clause per line and
// clipped so a 40-column Hibernate select cannot swallow the page.

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

/** The statement folded into display lines: one clause each, clipped in both directions. */
export function formatSqlLines(sql: string, parameters: string[] = []): string[] {
  // Hibernate emits comma-packed column lists; without a space they read as one
  // enormous "word" and the word clip below could never bite.
  const spaced = overCode(sql.replace(/\s+/g, ' ').trim(), (code) => code.replace(/\s*,\s*/g, ', '));

  // Values go in *after* the fold on purpose: a description reading "Follow up on
  // the vaccination" would otherwise be folded at its own ON.
  const bound = bindParameters(foldClauses(spaced), parameters);
  return capLines(bound.map(clipWords), MAX_LINES);
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
