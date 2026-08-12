import {
  After, AfterAll, Before, BeforeAll, ITestCaseHookParameter,
  setDefaultTimeout, setWorldConstructor, World, IWorldOptions,
} from '@cucumber/cucumber';
import {Browser, BrowserContext, chromium, Page} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import {appendWindow} from '../../tests/support/trace-window-store';
import {flushBrowserSpans} from '../../tests/support/otel-flush';
import {shouldGenerateSequence} from '../../src/trace-diagram/sequence-tag';
import {runGenerate} from '../../src/trace-diagram/generate';

setDefaultTimeout(60_000);

const WINDOWS_FILE = path.join(__dirname, '..', '..', 'test-results', 'trace-windows.json');
const DIAGRAMS_DIR = path.join(__dirname, '..', 'generated_sequences');

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
  // Set by the owner-search scenarios: every owner the API knows, by full name.
  allOwnerNames?: string[];
  // Set only for @generate_sequence scenarios: the title + start of the Tempo
  // search window whose traces become a sequence diagram.
  traceTitle?: string;
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

// Drop this run's recorded windows so the diagrams regenerated below come only
// from scenarios that just ran.
//
// Deliberately NOT wiping every .puml in DIAGRAMS_DIR: the plain-TypeScript
// twins (../*.spec.ts, run by Playwright) write their diagrams into the same
// folder, and a blanket wipe here would delete theirs — including add-visit's,
// whose @generate_sequence tags now live only on that side.
// run-tests-with-tracing.sh clears the folder once, before running either suite.
BeforeAll(function () {
  fs.mkdirSync(DIAGRAMS_DIR, {recursive: true});
  fs.rmSync(WINDOWS_FILE, {force: true});
});

Before(async function (this: PlaywrightWorld, {pickle}: ITestCaseHookParameter) {
  this.browser = await chromium.launch({headless: !process.env.HEADED});
  this.context = await this.browser.newContext({baseURL: process.env.BASE_URL || 'http://localhost:4200'});
  this.page = await this.context.newPage();

  if (shouldGenerateSequence(pickle.tags)) {
    this.traceTitle = pickle.name;
    // Stamp every browser span with the scenario name so Tempo can find this
    // run via `{ span.test.name = "..." }`.
    await this.page.addInitScript((name) => {
      (globalThis as any).__E2E_TEST_NAME__ = name;
    }, pickle.name);
    this.traceStartMs = Date.now() - PRE_PAD_MS;
  }
});

After(async function (this: PlaywrightWorld) {
  if (this.traceTitle && this.traceStartMs !== undefined) {
    await flushBrowserSpans(this.page);
    appendWindow(WINDOWS_FILE, {
      title: this.traceTitle,
      startMs: this.traceStartMs,
      endMs: Date.now() + POST_PAD_MS,
    });
  }
  await this.context?.close();
  await this.browser?.close();
});

// Render a PlantUML sequence diagram for each recorded window. Best-effort:
// runGenerate() never throws, so a telemetry hiccup can't fail the suite.
AfterAll(async function () {
  await runGenerate();
});
