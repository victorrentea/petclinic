import {test, expect} from '@playwright/test';
import {formatJsonLines, jsonNote} from './json-label';

test('pretty-prints a payload that came over the wire minified', () => {
  expect(formatJsonLines('{"id":42,"name":"Leo"}')).toEqual([
    '{',
    '  "id": 42,',
    '  "name": "Leo"',
    '}',
  ]);
});

test('a body that is not JSON is shown as it came', () => {
  expect(formatJsonLines('Owner 42 not found')).toEqual(['Owner 42 not found']);
});

test('an empty body draws nothing at all', () => {
  expect(formatJsonLines('   ')).toEqual([]);
  expect(jsonNote('Browser, Backend', '')).toEqual([]);
  expect(jsonNote('Browser, Backend', undefined)).toEqual([]);
});

// A list endpoint answers with every owner and their pets — pages of it. The
// note is there to show the shape of the payload, not to reproduce it.
test('caps a long payload', () => {
  const owners = Array.from({length: 50}, (_, i) => ({id: i}));
  const lines = formatJsonLines(JSON.stringify(owners));
  expect(lines.length).toBeLessThanOrEqual(14);
  expect(lines[lines.length - 1]).toBe('…');
});

test('caps a very wide line', () => {
  const [line] = formatJsonLines(`"${'x'.repeat(500)}"`);
  expect(line.length).toBe(91); // 90 chars + the ellipsis
});

test('jsonNote wraps the payload in a PlantUML note over both participants', () => {
  expect(jsonNote('Browser, Backend', '{"id":42}')).toEqual([
    'note over Browser, Backend',
    '{',
    '  "id": 42',
    '}',
    'end note',
  ]);
});
