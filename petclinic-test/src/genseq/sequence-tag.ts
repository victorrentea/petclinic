import * as path from 'path';

// A test opts into automatic sequence-diagram generation by carrying this tag —
// as a Cucumber scenario tag in a .feature, or as a Playwright test tag in the
// equivalent .spec.ts. Untagged tests run normally but record no trace window,
// so no .puml is produced for them.
export const GENERATE_SEQUENCE_TAG = '@generate_sequence';

// …or by being NAMED, without any tag in the source: GENSEQ_SELECT holds one test per
// line, `<test file basename>::<title>` ('owner-search.feature::Sorting by city, then
// reversing it') or a bare title. /human-review fills it with the tests a branch wrote or
// edited (human-review.json, steps.sequence.select), so a reviewer gets a picture of the
// scenarios the change is ABOUT — not only of the few somebody once tagged, which on the
// owners-paging branch were two visit flows that touched GET /api/owners in their setup.
export const SELECT_ENV = 'GENSEQ_SELECT';

export interface ScenarioTag {
  name: string;
}

/** Cucumber reports tags as `{name}` objects, Playwright as bare strings. */
export type Tag = ScenarioTag | string;

/** The tests GENSEQ_SELECT names, one per non-blank line. */
export function selectedTests(env: Record<string, string | undefined> = process.env): string[] {
  return (env[SELECT_ENV] ?? '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

/** Whether `title` (declared in `source`) is one GENSEQ_SELECT names. */
export function isSelected(
  title: string, source = '', env: Record<string, string | undefined> = process.env,
): boolean {
  const file = path.basename(source);
  return selectedTests(env).some((sel) => {
    const at = sel.indexOf('::');
    if (at < 0) return sel === title;
    return sel.slice(at + 2) === title && (!file || sel.slice(0, at) === file);
  });
}

export function shouldGenerateSequence(
  tags: readonly Tag[] = [], title?: string, source?: string,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (tags.some((t) => (typeof t === 'string' ? t : t.name) === GENERATE_SEQUENCE_TAG)) {
    return true;
  }
  return title !== undefined && isSelected(title, source, env);
}

/** RegExp source escaping, for the `--grep` that has to let a selected spec run. */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * What `playwright test --grep` must match so that the tagged tests AND the selected ones
 * run: `@generate_sequence|Title one|Title two`. Only the titles of .spec.ts selections
 * (or bare titles) — a .feature scenario is Cucumber's, and its title in Playwright's grep
 * could only ever match a spec that happens to share it.
 */
export function sequenceGrep(env: Record<string, string | undefined> = process.env): string {
  const titles = selectedTests(env)
    .filter((sel) => !sel.includes('::') || /\.spec\.[jt]sx?::/.test(sel))
    .map((sel) => (sel.includes('::') ? sel.slice(sel.indexOf('::') + 2) : sel));
  return [GENERATE_SEQUENCE_TAG, ...titles.map(escapeRegExp)].join('|');
}

if (require.main === module && process.argv[2] === 'grep') {
  process.stdout.write(sequenceGrep());
}
