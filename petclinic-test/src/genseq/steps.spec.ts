import {test, expect} from '@playwright/test';
import {StepRecorder, narrate, sentenceOf, stepAt} from './steps';

test('a function name becomes the sentence it was named after', () => {
  expect(sentenceOf('openOwnerDetailPage')).toBe('open owner detail page');
  expect(sentenceOf('anOwnerWithAtLeastOnePetExists')).toBe('an owner with at least one pet exists');
  expect(sentenceOf('submit')).toBe('submit');
});

// An acronym is one word, and splitting before its last letter — `HTTPR equest` — is the
// classic way to get this wrong.
test('an acronym stays one word', () => {
  expect(sentenceOf('sendHTTPRequest')).toBe('send http request');
});

test('the recorder stamps each sentence when it starts', () => {
  let clock = 100;
  const recorder = new StepRecorder(() => clock);
  recorder.start();
  recorder.mark('first');
  clock = 250;
  recorder.mark('second');
  expect(recorder.take()).toEqual([
    {label: 'first', atMs: 100},
    {label: 'second', atMs: 250},
  ]);
});

// The same sentence twice running would draw the same narration twice with nothing
// between the copies — a repetition the reader has no way to explain.
test('a sentence repeated back-to-back is one step', () => {
  const recorder = new StepRecorder(() => 1);
  recorder.mark('open the owners page');
  recorder.mark('open the owners page');
  expect(recorder.take()).toHaveLength(1);
});

test('taking the marks empties them, and start() drops the last scenario\'s', () => {
  const recorder = new StepRecorder(() => 1);
  recorder.mark('one');
  expect(recorder.take()).toHaveLength(1);
  expect(recorder.take()).toEqual([]);

  recorder.mark('leftover');
  recorder.start();
  expect(recorder.take()).toEqual([]);
});

test('narrate keeps the arguments, the return value and the names', () => {
  const recorder = new StepRecorder(() => 7);
  const sentences = {
    openOwnerDetailPage: (id: number) => `owner ${id}`,
    NOT_A_SENTENCE: 42,
  };
  const narrated = narrate(sentences, recorder);

  expect(narrated.openOwnerDetailPage(3)).toBe('owner 3');
  expect(narrated.NOT_A_SENTENCE).toBe(42);
  expect(recorder.take()).toEqual([{label: 'open owner detail page', atMs: 7}]);
});

// The mark is when the sentence *started*: stamped on the way out, it would sit below the
// very arrows it caused.
test('narrate marks before the call, not after', () => {
  let clock = 0;
  const recorder = new StepRecorder(() => clock);
  const narrated = narrate({doTheThing: () => {clock = 500;}}, recorder);
  narrated.doTheThing();
  expect(recorder.take()).toEqual([{label: 'do the thing', atMs: 0}]);
});

test('a trace belongs to the last sentence that had started', () => {
  const marks = [{label: 'first', atMs: 100}, {label: 'second', atMs: 200}];
  expect(stepAt(marks, 99)).toBeUndefined();       // before the scenario said anything
  expect(stepAt(marks, 100)).toEqual(marks[0]);    // exactly on the mark
  expect(stepAt(marks, 150)).toEqual(marks[0]);
  expect(stepAt(marks, 5_000)).toEqual(marks[1]);  // still the last one, long after
  expect(stepAt([], 150)).toBeUndefined();
});
