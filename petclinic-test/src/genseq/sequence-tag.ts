// A test opts into automatic sequence-diagram generation by carrying this tag —
// as a Cucumber scenario tag in a .feature, or as a Playwright test tag in the
// equivalent .spec.ts. Untagged tests run normally but record no trace window,
// so no .puml is produced for them.
export const GENERATE_SEQUENCE_TAG = '@generate_sequence';

export interface ScenarioTag {
  name: string;
}

/** Cucumber reports tags as `{name}` objects, Playwright as bare strings. */
export type Tag = ScenarioTag | string;

export function shouldGenerateSequence(tags: readonly Tag[] = []): boolean {
  return tags.some((t) => (typeof t === 'string' ? t : t.name) === GENERATE_SEQUENCE_TAG);
}
