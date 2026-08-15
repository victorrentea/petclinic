// Progressive disclosure needs the detail *beside* the picture, not inside it: the
// diagram stays simplified and every revealable arrow carries a stable id, while the
// statements and the payloads travel in a sidecar the review page reads.

/** One click's worth of detail — the panel shows `label` above `text`. */
export interface DetailStep {
  label: string;
  text: string;
}

/** Everything one arrow can reveal, in the order the clicks reveal it. */
export interface DetailEntry {
  title: string;
  steps: DetailStep[];
}

export interface DetailIndex {
  version: number;
  details: Record<string, DetailEntry>;
}

export const DETAIL_INDEX_VERSION = 1;

// FNV-1a. The id has to depend on the arrow's *content* alone: a counter would
// renumber every arrow below an inserted one, and the review page renders a
// textual diff of the .puml — one new query would then repaint half the diagram
// as changed. Two arrows carrying byte-identical detail sharing an id is not a
// collision, it is the same fact stored once.
function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(7, '0');
}

/** Gathers what each arrow can reveal, handing back the id to hang on the arrow. */
export class DetailCollector {
  private readonly entries = new Map<string, string>();

  /** The id for this entry — the same id whenever the entry is the same. */
  add(entry: DetailEntry): string {
    const serialized = JSON.stringify(entry);
    const base = fingerprint(serialized);
    // A real hash collision would silently show one arrow's SQL under another's,
    // so distinct content never shares an id, however unlikely the clash.
    for (let suffix = 0; ; suffix++) {
      const id = suffix === 0 ? base : `${base}-${suffix}`;
      const seen = this.entries.get(id);
      if (seen === undefined || seen === serialized) {
        this.entries.set(id, serialized);
        return id;
      }
    }
  }

  get size(): number {
    return this.entries.size;
  }

  toIndex(): DetailIndex {
    const details: Record<string, DetailEntry> = {};
    for (const [id, serialized] of this.entries) details[id] = JSON.parse(serialized);
    return {version: DETAIL_INDEX_VERSION, details};
  }
}
