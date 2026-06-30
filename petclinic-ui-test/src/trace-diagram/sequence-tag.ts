// A Cucumber scenario opts into automatic sequence-diagram generation by
// carrying this tag. Untagged scenarios run normally but record no trace
// window, so no .puml is produced for them.
export const GENERATE_SEQUENCE_TAG = '@generate_sequence';

export interface ScenarioTag {
  name: string;
}

export function shouldGenerateSequence(tags: readonly ScenarioTag[] = []): boolean {
  return tags.some((t) => t.name === GENERATE_SEQUENCE_TAG);
}
