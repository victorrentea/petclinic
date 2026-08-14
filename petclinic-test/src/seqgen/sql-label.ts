// A DB span's name is a generic "SELECT petclinic.owners" — true of every query
// the repository fires. The statement itself is what tells the reader *which*
// query ran, so the diagram carries the SQL, folded one clause per line and
// clipped so a 40-column Hibernate select cannot swallow the page.

const CLAUSE_KEYWORDS = [
  'select', 'from', 'where', 'group by', 'having', 'order by', 'limit', 'offset',
  'fetch first', 'fetch next', 'for update', 'union all', 'union', 'intersect', 'except',
  'inner join', 'left outer join', 'right outer join', 'full outer join',
  'left join', 'right join', 'full join', 'cross join', 'join', 'on conflict', 'on',
  'insert into', 'values', 'update', 'set', 'delete from', 'returning',
];

// Longest first, so "left outer join" wins over "join" and "on conflict" over "on"
// — JS alternation takes the first branch that matches at a position, not the longest.
const CLAUSE_RE = new RegExp(
  `\\b(${[...CLAUSE_KEYWORDS].sort((a, b) => b.length - a.length).join('|')})\\b`,
  'gi',
);

const MAX_WORDS_PER_LINE = 10;
const MAX_LINES = 8;
const ELLIPSIS = '…';

function clip(line: string): string {
  const words = line.split(' ');
  if (words.length <= MAX_WORDS_PER_LINE) return line;
  return [...words.slice(0, MAX_WORDS_PER_LINE), ELLIPSIS].join(' ');
}

/** The statement folded into display lines: one clause each, clipped in both directions. */
export function formatSqlLines(sql: string): string[] {
  const oneLine = sql
    .replace(/\s+/g, ' ')
    // Hibernate emits comma-packed column lists; without a space they read as one
    // enormous "word" and the word clip below could never bite.
    .replace(/\s*,\s*/g, ', ')
    .trim();

  const lines = oneLine
    .replace(CLAUSE_RE, (kw) => `\n${kw.toUpperCase()}`)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map(clip);

  if (lines.length <= MAX_LINES) return lines;
  return [...lines.slice(0, MAX_LINES - 1), ELLIPSIS];
}

/** The same, as a PlantUML message label — `\n` is PlantUML's own line break. */
export function formatSqlLabel(sql: string): string {
  return formatSqlLines(sql).join('\\n');
}

// A prepared statement travels as `?` placeholders with the values bound
// alongside; the agent captures them separately (db.query.parameter.N). Putting
// them back turns "which query ran" into "which query ran, on what".
export function applyParameters(sql: string, params: string[]): string {
  if (params.length === 0) return sql;
  let i = 0;
  return sql.replace(/\?/g, (placeholder) => (i < params.length ? params[i++] : placeholder));
}
