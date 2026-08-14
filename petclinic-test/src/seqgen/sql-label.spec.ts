import {test, expect} from '@playwright/test';
import {formatSqlLines, formatSqlLabel, applyParameters} from './sql-label';

test('breaks a statement into one line per clause, keywords uppercased', () => {
  const lines = formatSqlLines(
    'select o1_0.id,o1_0.last_name from petclinic.owners o1_0 where o1_0.last_name like ?',
  );
  expect(lines).toEqual([
    'SELECT o1_0.id, o1_0.last_name',
    'FROM petclinic.owners o1_0',
    'WHERE o1_0.last_name like ?',
  ]);
});

test('keeps a multi-word keyword whole instead of splitting it', () => {
  expect(formatSqlLines('insert into petclinic.visits (id) values (?)')).toEqual([
    'INSERT INTO petclinic.visits (id)',
    'VALUES (?)',
  ]);
  // "on conflict" must not be cut at the "on" of a join condition
  expect(formatSqlLines('insert into t (id) values (?) on conflict do nothing')).toContain(
    'ON CONFLICT do nothing',
  );
});

test('breaks joins onto their own line, condition included', () => {
  expect(formatSqlLines('select p.id from pets p left outer join visits v on v.pet_id=p.id'))
    .toEqual([
      'SELECT p.id',
      'FROM pets p',
      'LEFT OUTER JOIN visits v',
      'ON v.pet_id=p.id',
    ]);
});

// Hibernate's select lists run to dozens of columns — the shape of the query is
// the point of the diagram, not every column it happens to project.
test('truncates a clause longer than ten words', () => {
  const columns = Array.from({length: 30}, (_, i) => `o1_0.c${i}`).join(',');
  const [selectLine] = formatSqlLines(`select ${columns} from owners o1_0`);
  expect(selectLine.split(' ')).toHaveLength(11); // 10 words + the ellipsis
  expect(selectLine).toBe('SELECT o1_0.c0, o1_0.c1, o1_0.c2, o1_0.c3, o1_0.c4, o1_0.c5, o1_0.c6, o1_0.c7, o1_0.c8, …');
});

test('caps how many clause lines a single arrow may carry', () => {
  const unions = Array.from({length: 20}, () => 'select 1').join(' union all ');
  const lines = formatSqlLines(unions);
  expect(lines.length).toBeLessThanOrEqual(8);
  expect(lines[lines.length - 1]).toBe('…');
});

test('formatSqlLabel joins the clauses with PlantUML line breaks', () => {
  expect(formatSqlLabel('select 1 from dual')).toBe('SELECT 1\\nFROM dual');
});

test('a statement with nothing to break stays a single line', () => {
  expect(formatSqlLines('commit')).toEqual(['commit']);
});

test('applyParameters fills the placeholders in order', () => {
  expect(applyParameters('select * from owners where last_name=? and city=?', ['Potter', 'Cluj']))
    .toBe('select * from owners where last_name=Potter and city=Cluj');
});

// Capture can be off, or the agent can capture fewer values than there are
// placeholders — the statement must survive either way.
test('applyParameters leaves what it cannot fill alone', () => {
  expect(applyParameters('select * from owners where id=?', [])).toBe('select * from owners where id=?');
  expect(applyParameters('select * from o where a=? and b=?', ['1']))
    .toBe('select * from o where a=1 and b=?');
});
