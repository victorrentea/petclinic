import {sentenceOf} from './steps';

// A section header is the name of the test that drew it, and the reviewer's first
// question about any section is "which test is this?". Linking the header to the
// declaration answers that in one click, the same way the class boxes of the other
// generated diagrams do.
//
// The line is read back from the source rather than recorded while the test ran:
// Playwright's testInfo knows it, Cucumber's pickle does not, and one lookup that
// works for both keeps the span cache — which predates all of this — replayable. A
// run re-rendered a week later then points at where the test is *now*, not at the
// line it happened to sit on when it ran.

/** One wording for every header link, like the tooltips the other diagrams use. */
export const TEST_LINK_TOOLTIP = '{Click to open the test}';

/** And one for a step arrow, which opens a line rather than a whole test. */
export const STEP_LINK_TOOLTIP = '{Click to open the line of the test that says this}';

/** A JUnit test method: `void adds_a_visit_to_an_existing_pet()`. */
const JAVA_METHOD = /\bvoid\s+([A-Za-z_$][\w$]*)\s*\(/;

/**
 * The 1-based line `title` is declared on — `test('<title>'` in a .spec.ts,
 * `Scenario: <title>` in a .feature — both being simply the first line that names it.
 *
 * `sourceName` is the file the text came from, and is only consulted when that scan
 * finds nothing: a @SpringBootTest's section is titled with the sentence JUnit displays
 * for the method (@DisplayNameGeneration(PrettyTestNames)), and that sentence is never
 * written in the .java file — the method is `adds_a_visit_to_an_existing_pet`. Rather
 * than reimplement the generator, the method name goes through the same
 * camelCase/snake_case-to-words reading the DSL narration uses; the two agree because
 * they are the same transformation.
 *
 * 0 when the source never names it, which is what a Scenario Outline looks like from
 * here: its pickles are titled with the example values already substituted in. A
 * missing line is a link to the file, not a missing link.
 */
export function lineOfTest(source: string, title: string, sourceName = ''): number {
  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(title)) return i + 1;
  }
  if (!sourceName.endsWith('.java')) return 0;
  const wanted = sentenceOf(title.trim());
  for (let i = 0; i < lines.length; i++) {
    const method = JAVA_METHOD.exec(lines[i])?.[1];
    if (method !== undefined && sentenceOf(method) === wanted) return i + 1;
  }
  return 0;
}

/**
 * The clickable handle, as `src://<repo-relative path>[:line]`.
 *
 * Deliberately NOT an absolute `vscode://file/...` URL: the .puml is a committed
 * artifact, and baking `/Users/someone/...` into it makes every machine that
 * regenerates it produce a diff. The review page resolves the handle against its own
 * checkout when it inlines the SVG.
 */
export function testHandle(repoRelativeSource: string, line: number): string {
  return `src://${repoRelativeSource}${line > 0 ? `:${line}` : ''}`;
}

/** `title`, as the clickable face of the test it names. */
export function linkedSectionTitle(title: string, handle: string | undefined): string {
  return handle ? `[[${handle}${TEST_LINK_TOOLTIP} ${title}]]` : title;
}


// ── the sentence arrows ──────────────────────────────────────────────────────────
//
// A @SpringBootTest's `given`/`when`/`then` marks are drawn as self-calls on the Test
// lifeline, and each one is a line somebody wrote. Linking the arrow to that line closes
// the last gap in the picture: the section header says which test, the self-calls below
// say which method of the app, and this says which sentence of the test caused them.
//
// Like every other link here, the line is read back from today's source rather than
// recorded while the test ran. A step span could have carried its own stack frame — the
// test and the code share a JVM — but a diagram re-rendered from the span cache a week
// later would then point at the line the sentence occupied *then*. Reading it back keeps
// a cached re-render as correct as a fresh run, which is the property the whole generator
// is built around.

/** The keywords `Steps.java` prefixes a sentence with; anything else is not a step. */
const STEP_KEYWORDS = new Set(['given', 'when', 'then', 'and']);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The line number a `src://path:line` handle carries, or 0 when it carries none. */
export function lineOfHandle(handle: string | undefined): number {
  const line = /:(\d+)$/.exec(handle ?? '')?.[1];
  return line ? Number(line) : 0;
}

/**
 * The 1-based line the step `label` was stamped on — the `given("…")` that wrote it —
 * or 0 when this checkout does not say it in those words.
 *
 * `from` is where to start looking, and it is not an optimisation: two scenarios in one
 * file routinely open with the identical sentence (both of AddVisitSequenceTest's do),
 * and a scan from the top would point every one of them at the first. The caller passes
 * the scenario's own declaration line, so each section's arrows resolve inside it.
 *
 * The search is for the call as it is written, quotes and all. A sentence assembled at
 * runtime — `given("a visit on " + date)` — is therefore not found, and 0 is the right
 * answer for it rather than a nearby line that happens to mention the words.
 */
export function lineOfStep(source: string, label: string, from = 1): number {
  const space = label.indexOf(' ');
  if (space < 0) return 0;
  const keyword = label.slice(0, space);
  if (!STEP_KEYWORDS.has(keyword)) return 0;
  const call = new RegExp(
    `\\b${keyword}\\s*\\(\\s*"${escapeRegExp(label.slice(space + 1))}"`);
  const lines = source.split(/\r?\n/);
  for (let i = Math.max(0, from - 1); i < lines.length; i++) {
    if (call.test(lines[i])) return i + 1;
  }
  return 0;
}

/**
 * The clickable handle for one step arrow, or undefined when its line was not found.
 *
 * Undefined rather than a link to the file with no line, which is what a section header
 * falls back to: the header is the only thing pointing at the test and is worth keeping
 * at any precision, while an arrow that lands on the top of a file the header already
 * opened has cost a click to say nothing.
 */
export function stepHandle(repoRelativeSource: string, line: number): string | undefined {
  return line > 0 ? `src://${repoRelativeSource}:${line}${STEP_LINK_TOOLTIP}` : undefined;
}
