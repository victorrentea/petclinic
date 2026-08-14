import {test, expect} from '@playwright/test';
import {shouldGenerateSequence, GENERATE_SEQUENCE_TAG} from './sequence-tag';

test('opts in only when the @generate_sequence tag is present', () => {
  expect(shouldGenerateSequence([{ name: GENERATE_SEQUENCE_TAG }])).toBe(true);
  expect(shouldGenerateSequence([{ name: '@smoke' }, { name: '@generate_sequence' }])).toBe(true);
});

test('opts out when the tag is absent or there are no tags', () => {
  expect(shouldGenerateSequence([{ name: '@smoke' }])).toBe(false);
  expect(shouldGenerateSequence([])).toBe(false);
  expect(shouldGenerateSequence()).toBe(false);
});

// Playwright exposes testInfo.tags as bare strings, Cucumber as {name} objects:
// the same opt-in rule has to read both.
test('accepts Playwright-style string tags', () => {
  expect(shouldGenerateSequence([GENERATE_SEQUENCE_TAG])).toBe(true);
  expect(shouldGenerateSequence(['@smoke', '@generate_sequence'])).toBe(true);
  expect(shouldGenerateSequence(['@smoke'])).toBe(false);
});
