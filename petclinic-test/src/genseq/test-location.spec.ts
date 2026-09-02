import {test, expect} from '@playwright/test';
import {lineOfTest, testHandle, linkedSectionTitle, TEST_LINK_TOOLTIP} from './test-location';

const SPEC = [
  "import {test} from './support/trace-fixture';",
  '',
  '// Add a visit to an existing pet from the owner detail page — the happy path',
  "test('Add a visit attended by a vet',",
  '  {tag: ["@generate_sequence"]}, async ({page}) => {});',
].join('\n');

const FEATURE = [
  'Feature: Owner search',
  '',
  '  @generate_sequence',
  '  Scenario: Searching with an empty last name lists every owner',
  '    Given the owner list',
].join('\n');

test('finds the line a Playwright test is declared on', () => {
  expect(lineOfTest(SPEC, 'Add a visit attended by a vet')).toBe(4);
});

test('finds the line a Cucumber scenario is declared on', () => {
  expect(lineOfTest(FEATURE, 'Searching with an empty last name lists every owner')).toBe(4);
});

// A comment naming the test comes first in the file; it is still the place a reviewer
// wants to land, and the declaration is two lines below it.
test('takes the first line that names the test, comment or declaration', () => {
  expect(lineOfTest(SPEC, 'Add a visit to an existing pet from the owner detail page')).toBe(3);
});

// A Scenario Outline's pickles are titled with the example values substituted in, so
// the outline's own line cannot be found by name.
test('reports no line when the source never names the test', () => {
  expect(lineOfTest(FEATURE, 'Filter owners by prefix "Fr"')).toBe(0);
});

// Repo-relative, never absolute: the .puml is committed, and `/Users/someone/...` in it
// is a diff on every machine that regenerates the diagram.
test('the handle is repo-relative, and drops the line it does not have', () => {
  expect(testHandle('petclinic-test/src/add-visit.spec.ts', 26))
    .toBe('src://petclinic-test/src/add-visit.spec.ts:26');
  expect(testHandle('petclinic-test/src/owner-search.feature', 0))
    .toBe('src://petclinic-test/src/owner-search.feature');
});

test('the header wraps the title in the link, and is the bare title without one', () => {
  expect(linkedSectionTitle('Add a visit', 'src://x.spec.ts:3'))
    .toBe(`[[src://x.spec.ts:3${TEST_LINK_TOOLTIP} Add a visit]]`);
  expect(linkedSectionTitle('Add a visit', undefined)).toBe('Add a visit');
});
