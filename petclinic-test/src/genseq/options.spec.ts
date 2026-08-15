import {test, expect} from '@playwright/test';
import {DEFAULT_DIAGRAM_OPTIONS, describeOptions, optionsFromEnv} from './options';

test('an empty environment renders the middle ground: SQL, no payloads', () => {
  expect(optionsFromEnv({})).toEqual({sql: 'statement', httpBodies: false, interactive: true});
  expect(optionsFromEnv({})).toEqual(DEFAULT_DIAGRAM_OPTIONS);
});

test('SEQ_SQL takes the three levels, however they are spelled', () => {
  expect(optionsFromEnv({SEQ_SQL: 'off'}).sql).toBe('off');
  expect(optionsFromEnv({SEQ_SQL: '0'}).sql).toBe('off');
  expect(optionsFromEnv({SEQ_SQL: 'VALUES'}).sql).toBe('values');
  expect(optionsFromEnv({SEQ_SQL: ' params '}).sql).toBe('values');
  expect(optionsFromEnv({SEQ_SQL: 'statement'}).sql).toBe('statement');
});

test('SEQ_HTTP_BODIES is a plain switch', () => {
  expect(optionsFromEnv({SEQ_HTTP_BODIES: '1'}).httpBodies).toBe(true);
  expect(optionsFromEnv({SEQ_HTTP_BODIES: 'true'}).httpBodies).toBe(true);
  expect(optionsFromEnv({SEQ_HTTP_BODIES: '0'}).httpBodies).toBe(false);
});

// A typo must not silently produce a diagram at a level nobody asked for.
test('an unrecognized value falls back to the default', () => {
  expect(optionsFromEnv({SEQ_SQL: 'yolo'}).sql).toBe(DEFAULT_DIAGRAM_OPTIONS.sql);
  expect(optionsFromEnv({SEQ_HTTP_BODIES: 'yolo'}).httpBodies).toBe(DEFAULT_DIAGRAM_OPTIONS.httpBodies);
});

test('SEQ_INTERACTIVE=0 goes back to baking the detail into the picture', () => {
  expect(optionsFromEnv({}).interactive).toBe(true);
  expect(optionsFromEnv({SEQ_INTERACTIVE: '0'}).interactive).toBe(false);
  expect(optionsFromEnv({SEQ_INTERACTIVE: 'off'}).interactive).toBe(false);
  expect(optionsFromEnv({SEQ_INTERACTIVE: 'yolo'}).interactive).toBe(true);
});

test('describeOptions states the level a generated file was rendered at', () => {
  expect(describeOptions({sql: 'values', httpBodies: true, interactive: false}))
    .toBe('SQL shown, with values · HTTP bodies shown');
  expect(describeOptions({sql: 'off', httpBodies: false, interactive: false}))
    .toBe('SQL not shown · HTTP bodies not shown');
});

// An interactive diagram shows none of it up front, so naming a level would lie —
// what the header owes the reader is what a click will bring up.
test('describeOptions names what is revealable rather than what is drawn', () => {
  expect(describeOptions({sql: 'statement', httpBodies: true, interactive: true}))
    .toBe('simplified · click an arrow to reveal its SQL / JSON payloads');
  expect(describeOptions({sql: 'statement', httpBodies: false, interactive: true}))
    .toBe('simplified · click an arrow to reveal its SQL');
  expect(describeOptions({sql: 'off', httpBodies: false, interactive: true}))
    .toBe('simplified · nothing recorded to reveal');
});
