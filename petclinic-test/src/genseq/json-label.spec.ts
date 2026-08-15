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

// Wrapped, not clipped: the browser truncates a big body mid-JSON, which makes it
// unparseable, and clipping the resulting single line to 90 chars would show a
// fraction of the payload exactly when the payload is what you wanted to see.
test('wraps a very wide line instead of clipping it away', () => {
  const lines = formatJsonLines(`"${'x'.repeat(500)}"`);
  expect(lines.length).toBe(6);
  expect(lines[0].length).toBe(90);
  expect(lines.join('')).toContain('x'.repeat(500));
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
