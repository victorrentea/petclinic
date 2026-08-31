// Which line of the test a diagram's `== section ==` came from.
//
// A diagram holds one section per scenario in its file, and the reader's next question about
// any of them is "show me the test that did this". The file is already known — the diagram is
// filed next to it and named after it — so all that is missing is the line, and each of the
// three test styles states its scenario titles plainly enough to be found by reading.
//
// Resolved at render time rather than stored with the fetched spans: re-rendering the cached
// spans of an older run (npm run diagram) must point at where the scenario is *now*, not at
// where it was when Tempo was queried.

import {sentenceOf} from './steps';

/** `Scenario:`, `Scenario Outline:`, `Example:` — the Gherkin keywords that open a scenario. */
const GHERKIN = /^\s*(?:Scenario Outline|Scenario Template|Scenario|Example)\s*:\s*(.*?)\s*$/;

/** `test('…', …)` / `it("…")` — Playwright and every other JS runner spell it the same way. */
const JS_TEST = /^\s*(?:test|it)(?:\.\w+)*\s*\(\s*(['"`])(.*?)\1/;

/** A JUnit test method: `void addsAVisitToAnExistingPet()`. */
const JAVA_METHOD = /\bvoid\s+([A-Za-z_$][\w$]*)\s*\(/;

/**
 * The 1-based line where `title`'s scenario is written, or undefined when it cannot be found.
 *
 * Undefined is a normal answer, not a failure: a Scenario Outline's sections are titled after
 * the outline, an unusual test helper may not be recognised, and a scenario renamed since the
 * traces were fetched is simply no longer there. The section then renders as it always did —
 * plain text rather than a link that goes somewhere wrong.
 */
export function scenarioLine(source: string, title: string, text: string): number | undefined {
  const lines = text.split('\n');
  const wanted = title.trim();

  for (let i = 0; i < lines.length; i++) {
    if (matches(source, lines[i], wanted)) return i + 1;
  }
  return undefined;
}

function matches(source: string, line: string, wanted: string): boolean {
  if (source.endsWith('.feature')) {
    return GHERKIN.exec(line)?.[1] === wanted;
  }
  if (source.endsWith('.java')) {
    // JUnit shows a method under its @DisplayName as a sentence, and that sentence is the
    // section's title. Rather than parse the annotation, put the method name through the same
    // camelCase-to-words reading the DSL narration uses — the two agree because the @DisplayName
    // spells out exactly what that transformation produces.
    const method = JAVA_METHOD.exec(line)?.[1];
    return method !== undefined && sentenceOf(method) === sentenceOf(wanted);
  }
  return JS_TEST.exec(line)?.[2] === wanted;
}
