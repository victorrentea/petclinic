// The sentence the test was on when a call went out.
//
// A diagram drawn from traces alone answers "what did the system do". It cannot answer
// "which line of the test made it do that" — the traces carry HTTP routes and SQL, and
// nothing in them knows the scenario was on `When I search owners for ""`. So the test
// stamps its own sentences as it walks through them, and the renderer folds those marks
// back in between the traces: one self-call on the driving lifeline, above the arrows
// that sentence caused.
//
// A timestamp, not a span: the browser and the backend are already traced by two
// different exporters, and threading a third context through Playwright's Node process
// into the page would buy nothing here. Both clocks are the same machine's, the marks
// and the traces are minutes apart at worst, and a step boundary only has to land
// between two HTTP calls — a resolution of milliseconds, against calls that are tens of
// milliseconds apart.
//
// (The @SpringBootTest half of this does use a span, because there it is free: the test
// and the code under test share one JVM and one OTel context. See
// petclinic-backend/src/test/java/victor/training/petclinic/genseq/.)

/** One sentence of a scenario, stamped when it started. */
export interface StepMark {
  label: string;
  atMs: number;
}

/** `openOwnerDetailPage` → `open owner detail page`. */
export function sentenceOf(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    // `anOwnerWithAtLeastOnePetExistsHTTP` — an acronym run keeps its last letter for the
    // word that follows it, so `HTTPRequest` reads `HTTP request` and not `HTTPR equest`.
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * The marks of the scenario currently running.
 *
 * One recorder per process, deliberately: Playwright gives each worker its own process
 * and runs one test at a time in it, and Cucumber runs a whole file serially. Two
 * scenarios can therefore never be writing here at once — which is the same reasoning
 * that lets the trace window be a single start/end pair per scenario.
 */
export class StepRecorder {
  private marks: StepMark[] = [];

  constructor(private readonly now: () => number = Date.now) {}

  /** Begin a scenario: whatever the last one left behind is not this one's. */
  start(): void {
    this.marks = [];
  }

  mark(label: string): void {
    const text = label.trim();
    if (!text) return;
    // A sentence repeated back-to-back is one step, not two: the diagram would draw the
    // same narration twice with nothing between the copies to explain the repetition.
    if (this.marks[this.marks.length - 1]?.label === text) return;
    this.marks.push({label: text, atMs: this.now()});
  }

  /** Hand over what this scenario recorded, and forget it. */
  take(): StepMark[] {
    const taken = this.marks;
    this.marks = [];
    return taken;
  }
}

/** What the narrated DSL and the Cucumber hooks write into. */
export const steps = new StepRecorder();

/**
 * The same sentences, each announcing itself before it runs.
 *
 * `add-visit.spec.ts` imports its DSL through this, so the spec body stays exactly the
 * list of sentences it was — no `test.step()` wrapper round every line, no second name
 * for anything. The sentence on the diagram is the function's own name, so it cannot
 * drift from the code: rename the function and the narration renames itself.
 */
export function narrate<T extends object>(sentences: T, recorder: StepRecorder = steps): T {
  const narrated: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(sentences)) {
    narrated[name] = typeof value !== 'function' ? value : (...args: unknown[]) => {
      // Marked before the call, not after: the mark is when the sentence *started*, and
      // every call it makes happens after that instant. Stamping on the way out would
      // put the sentence below its own arrows.
      recorder.mark(sentenceOf(name));
      return (value as (...a: unknown[]) => unknown)(...args);
    };
  }
  return narrated as T;
}

/** The sentence a trace belongs to: the last one that had started when the trace opened. */
export function stepAt(marks: readonly StepMark[], atMs: number): StepMark | undefined {
  let found: StepMark | undefined;
  for (const mark of marks) {
    if (mark.atMs > atMs) break;
    found = mark;
  }
  return found;
}
