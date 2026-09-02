import {
  After, AfterAll, Before, BeforeAll, BeforeStep, ITestCaseHookParameter, ITestStepHookParameter,
  setDefaultTimeout, setWorldConstructor, World, IWorldOptions,
} from '@cucumber/cucumber';
import * as messages from '@cucumber/messages';
import {Browser, BrowserContext, chromium, Page} from '@playwright/test';
import * as path from 'path';
import {appendWindow, forgetWindowsOf} from './trace-window-store';
import {flushBrowserSpans} from './otel-flush';
import {shouldGenerateSequence} from '../genseq/sequence-tag';
import {runGenerate, CUCUMBER_SOURCES} from '../genseq/generate';
import {StepMark, steps} from '../genseq/steps';

setDefaultTimeout(60_000);

const WINDOWS_DIR = path.join(__dirname, '..', '..', 'test-results', 'trace-windows');

// Pads the recorded window so the BatchSpanProcessor's async export (and Tempo
// ingestion lag) still falls inside the search range — mirrors the Playwright
// trace fixture.
const PRE_PAD_MS = 1_000;
const POST_PAD_MS = 5_000;

export class PlaywrightWorld extends World {
  browser!: Browser;
  context!: BrowserContext;
  page!: Page;
  ownerId?: number;
  petId?: number;
  visitDescription?: string;
  petBirthDate?: string;
  // The refused response the visit-date-range API scenarios assert on.
  apiResponse?: any;
  // Set by the owner-search scenarios: every owner the API knows, by full name.
  allOwnerNames?: string[];
  // Set only for @generate_sequence scenarios: the title + start of the Tempo
  // search window whose traces become a sequence diagram.
  traceTitle?: string;
  traceSource?: string;
  traceStartMs?: number;

  constructor(options: IWorldOptions) {
    super(options);
  }

  requireAllOwnerNames(): string[] {
    if (!this.allOwnerNames) {
      throw new Error('Expected the sample owners to have been loaded earlier in the scenario');
    }
    return this.allOwnerNames;
  }
}

setWorldConstructor(PlaywrightWorld);

// Drop the previous run's windows for the scenarios this runner owns (*.feature),
// so the diagrams regenerated below come only from scenarios that just ran. The
// Playwright suite's windows are left alone — they are what a later
// `npm run diagram` replays. Mirrors Playwright's global-setup.
//
// Deliberately NOT deleting any .genseq.puml: each suite rewrites only the diagrams
// of its own source files, and the other suite's are none of its business.
BeforeAll(function () {
  forgetWindowsOf(WINDOWS_DIR, CUCUMBER_SOURCES);
});

/**
 * The keyword the .feature actually wrote — `When `, `And `, `Then `.
 *
 * A pickle step has only its text and a coarse Given/When/Then `type`, because that is
 * all a *runner* needs. The diagram is quoting the file back at the reader, so it goes to
 * the Gherkin document for the real word: an `And` narrated as `When` would be a sentence
 * the author never wrote, in a picture whose whole claim is that it shows what happened.
 */
function keywordOf(document: messages.GherkinDocument, step: messages.PickleStep): string {
  const nodes = new Map<string, messages.Step>();
  const collect = (children: readonly messages.FeatureChild[] | readonly messages.RuleChild[] = []): void => {
    for (const child of children) {
      for (const s of child.background?.steps ?? []) nodes.set(s.id, s);
      for (const s of child.scenario?.steps ?? []) nodes.set(s.id, s);
      if ('rule' in child && child.rule) collect(child.rule.children);
    }
  };
  collect(document.feature?.children);
  // astNodeIds[0] is the step itself; a Scenario Outline step also lists the Examples row.
  return nodes.get(step.astNodeIds[0])?.keyword ?? '';
}

// Every step of a traced scenario, stamped as it starts. Untraced scenarios record
// nothing: `traceTitle` is set only for @generate_sequence, and the recorder is what the
// window carries away in After.
BeforeStep(function (this: PlaywrightWorld, {gherkinDocument, pickleStep}: ITestStepHookParameter) {
  if (!this.traceTitle) return;
  steps.mark(`${keywordOf(gherkinDocument, pickleStep)}${pickleStep.text}`);
});

Before(async function (this: PlaywrightWorld, {pickle}: ITestCaseHookParameter) {
  this.browser = await chromium.launch({headless: !process.env.HEADED});
  this.context = await this.browser.newContext({baseURL: process.env.BASE_URL || 'http://localhost:4200'});
  this.page = await this.context.newPage();

  if (shouldGenerateSequence(pickle.tags)) {
    this.traceTitle = pickle.name;
    this.traceSource = path.relative(path.join(__dirname, '..', '..'), pickle.uri);
    // Stamp every browser span with the scenario name so Tempo can find this
    // run via `{ span.test.name = "..." }`.
    await this.page.addInitScript((name) => {
      (globalThis as any).__E2E_TEST_NAME__ = name;
    }, pickle.name);
    steps.start();
    this.traceStartMs = Date.now() - PRE_PAD_MS;
  }
});

After(async function (this: PlaywrightWorld) {
  if (this.traceTitle && this.traceStartMs !== undefined) {
    await flushBrowserSpans(this.page);
    appendWindow(WINDOWS_DIR, {
      title: this.traceTitle,
      source: this.traceSource!,
      startMs: this.traceStartMs,
      endMs: Date.now() + POST_PAD_MS,
      steps: steps.take(),
    });
  }
  await this.context?.close();
  await this.browser?.close();
});

// Render a PlantUML sequence diagram for each recorded window. Best-effort:
// Only this suite's diagrams: the Playwright windows in the same file are there so a
// standalone `npm run diagram` can re-render every diagram, not for this run to rewrite.
// runGenerate() never throws, so a telemetry hiccup can't fail the suite.
AfterAll(async function () {
  await runGenerate(CUCUMBER_SOURCES);
});
