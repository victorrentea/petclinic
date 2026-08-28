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

/**
 * The 1-based line `title` is declared on — `test('<title>'` in a .spec.ts,
 * `Scenario: <title>` in a .feature — both being simply the first line that names it.
 *
 * 0 when the source never names it, which is what a Scenario Outline looks like from
 * here: its pickles are titled with the example values already substituted in. A
 * missing line is a link to the file, not a missing link.
 */
export function lineOfTest(source: string, title: string): number {
  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(title)) return i + 1;
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
