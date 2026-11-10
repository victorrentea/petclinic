import {test, expect} from '@playwright/test';
import {DEFAULT_DIAGRAM_OPTIONS, describeOptions, optionsFromEnv} from './options';

test('an empty environment reveals everything the traces carry, a click at a time', () => {
  expect(optionsFromEnv({})).toEqual({sql: 'statement', httpBodies: true, interactive: true, handler: 'line'});
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
  expect(describeOptions({sql: 'values', httpBodies: true, interactive: false, handler: 'line'}))
    .toBe('SQL shown, with values · HTTP bodies shown · controllers under their request');
  expect(describeOptions({sql: 'off', httpBodies: false, interactive: false, handler: 'call'}))
    .toBe('SQL not shown · HTTP bodies not shown · controllers as calls');
});

// An interactive diagram shows none of it up front, so naming a level would lie —
// what the header owes the reader is what a click will bring up. An HTTP request always
// opens, its URL and headers there to show with every payload switched off.
test('describeOptions names what is revealable rather than what is drawn', () => {
  expect(describeOptions({sql: 'statement', httpBodies: true, interactive: true, handler: 'line'}))
    .toBe('simplified · click an arrow to reveal its SQL / HTTP requests / JSON payloads'
      + ' · controllers under their request');
  expect(describeOptions({sql: 'statement', httpBodies: false, interactive: true, handler: 'line'}))
    .toBe('simplified · click an arrow to reveal its SQL / HTTP requests · controllers under their request');
  expect(describeOptions({sql: 'off', httpBodies: false, interactive: true, handler: 'call'}))
    .toBe('simplified · click an arrow to reveal its HTTP requests · controllers as calls');
});

// The request's words open the request now, so the controller needs a place of its own; both
// shapes are kept to compare on a real diagram (Victor, 10 Nov 2026).
test('SEQ_HANDLER places the controller on a line of its own or as a call', () => {
  expect(optionsFromEnv({}).handler).toBe('line');
  expect(optionsFromEnv({SEQ_HANDLER: 'call'}).handler).toBe('call');
  expect(optionsFromEnv({SEQ_HANDLER: ' CALL '}).handler).toBe('call');
  expect(optionsFromEnv({SEQ_HANDLER: 'line'}).handler).toBe('line');
  expect(optionsFromEnv({SEQ_HANDLER: 'constructor'}).handler).toBe('line');
  expect(optionsFromEnv({SEQ_HANDLER: 'yolo'}).handler).toBe(DEFAULT_DIAGRAM_OPTIONS.handler);
});

// Payloads are free behind a click and expensive baked in, so the default follows the
// mode rather than being one answer for both.
test('payloads follow the mode unless asked for by name', () => {
  expect(optionsFromEnv({}).httpBodies).toBe(true);                       // interactive
  expect(optionsFromEnv({SEQ_INTERACTIVE: '0'}).httpBodies).toBe(false);  // baked in
  expect(optionsFromEnv({SEQ_INTERACTIVE: '0', SEQ_HTTP_BODIES: '1'}).httpBodies).toBe(true);
  expect(optionsFromEnv({SEQ_HTTP_BODIES: '0'}).httpBodies).toBe(false);
});
