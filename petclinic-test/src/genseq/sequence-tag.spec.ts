import {test, expect} from '@playwright/test';
import {isSelected, sequenceGrep, shouldGenerateSequence, GENERATE_SEQUENCE_TAG} from './sequence-tag';

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

// /human-review names the tests a branch wrote, which carry no tag (steps.sequence.select).
test('an untagged test named in GENSEQ_SELECT is traced too, by file and title', () => {
  const env = {GENSEQ_SELECT: 'owner-search.feature::Sorting by city, then reversing it\n'
    + 'Paging forward\n'};
  expect(shouldGenerateSequence([], 'Sorting by city, then reversing it',
    'src/owner-search.feature', env)).toBe(true);
  // the same title in another file is another test
  expect(shouldGenerateSequence([], 'Sorting by city, then reversing it',
    'src/other.feature', env)).toBe(false);
  // a bare title matches in any file
  expect(shouldGenerateSequence([], 'Paging forward', 'src/x.spec.ts', env)).toBe(true);
  expect(shouldGenerateSequence([], 'Paging', 'src/x.spec.ts', env)).toBe(false);
  expect(shouldGenerateSequence([], 'Paging forward', 'src/x.spec.ts', {})).toBe(false);
});

test('the Playwright grep keeps the tag and adds only spec titles, escaped', () => {
  expect(sequenceGrep({})).toBe('@generate_sequence');
  expect(sequenceGrep({GENSEQ_SELECT: 'add-owner.spec.ts::adds (a) owner\n'
    + 'owner-search.feature::Sorting by city'})).toBe('@generate_sequence|adds \\(a\\) owner');
  expect(isSelected('Sorting by city', 'owner-search.feature',
    {GENSEQ_SELECT: 'owner-search.feature::Sorting by city'})).toBe(true);
});
