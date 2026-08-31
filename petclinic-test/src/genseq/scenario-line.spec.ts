import {test, expect} from '@playwright/test';
import {scenarioLine} from './scenario-line';

const FEATURE = [
  'Feature: Search owners by last name',
  '',
  '  Background:',
  '    Given the clinic has these owners',
  '',
  '  Scenario Outline: Filter owners by a prefix',
  '    When I open the owners page',
  '',
  '  @generate_sequence',
  '  Scenario: Searching with an empty last name lists every owner',
  '    When I open the owners page',
].join('\n');

test('a Gherkin scenario is found by its keyword and title', () => {
  expect(scenarioLine('src/owner-search.feature', 'Searching with an empty last name lists every owner', FEATURE))
    .toBe(10);
  expect(scenarioLine('src/owner-search.feature', 'Filter owners by a prefix', FEATURE)).toBe(6);
});

// The Background is not a scenario, and a step that happens to read like a title is not one
// either — only the keyword line counts.
test('a Gherkin step is never mistaken for a scenario', () => {
  expect(scenarioLine('src/owner-search.feature', 'I open the owners page', FEATURE)).toBeUndefined();
});

const SPEC = [
  "import {test} from './support/trace-fixture';",
  '',
  "test('Add a visit to an existing pet from the owner detail page',",
  '  {tag: [GENERATE_SEQUENCE_TAG]},',
  '  async ({page}) => {});',
  '',
  'test.skip("a skipped one", async () => {});',
].join('\n');

test('a Playwright test is found whichever quote it used', () => {
  expect(scenarioLine('src/add-visit.spec.ts', 'Add a visit to an existing pet from the owner detail page', SPEC))
    .toBe(3);
  expect(scenarioLine('src/add-visit.spec.ts', 'a skipped one', SPEC)).toBe(7);
});

const JAVA = [
  'class AddVisitSequenceTest {',
  '',
  '    @Test',
  '    void addsAVisitToAnExistingPet() throws Exception {',
  '    }',
  '}',
].join('\n');

// JUnit shows the method as a sentence via its @DisplayName, and that sentence is the section
// title. Rather than parse the annotation, the method name goes through the same
// camelCase-to-words reading the DSL narration uses — they agree because the @DisplayName spells
// out exactly what that transformation produces.
test('a JUnit method is found through its generated display name', () => {
  expect(scenarioLine('../petclinic-backend/…/AddVisitSequenceTest.java',
    'adds a visit to an existing pet', JAVA)).toBe(4);
});

// Undefined is a normal answer — the section then renders as the plain text it always did,
// rather than as a link that goes somewhere wrong.
test('a scenario that is no longer there yields no line', () => {
  expect(scenarioLine('src/owner-search.feature', 'renamed since the traces were fetched', FEATURE))
    .toBeUndefined();
  expect(scenarioLine('src/add-visit.spec.ts', 'never existed', SPEC)).toBeUndefined();
});
