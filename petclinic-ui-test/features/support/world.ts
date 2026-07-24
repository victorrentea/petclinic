import {
  After, AfterAll, Before, BeforeAll, ITestCaseHookParameter,
  setDefaultTimeout, setWorldConstructor, World, IWorldOptions,
} from '@cucumber/cucumber';
import {Browser, BrowserContext, chromium, Page} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import {appendWindow} from '../../tests/support/trace-window-store';
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
  // Set by the owner-search scenario: the last-name part typed into the filter
  // and the owner full names the API returns for it (the expected result set).
  searchPrefix?: string;
  expectedFullNames?: string[];
  // Set by the owners-pagination scenarios: the server's totals for the unfiltered
  // list and the owner ids collected while walking every page of the grid.
  totalOwners?: number;
  totalOwnerPages?: number;
  ownerIdsSeenWhilePaging?: number[];
  // Set only for @generate_sequence scenarios: the title + start of the Tempo
  // search window whose traces become a sequence diagram.
  traceTitle?: string;
  traceStartMs?: number;

  constructor(options: IWorldOptions) {
    super(options);
  }
}

setWorldConstructor(PlaywrightWorld);

// Start each regenerating run from a clean slate: drop every previously
// generated .puml and any stale recorded windows, so the diagrams left behind
// are exactly the ones this run produces.
BeforeAll(function () {
  fs.mkdirSync(DIAGRAMS_DIR, {recursive: true});
  for (const f of fs.readdirSync(DIAGRAMS_DIR)) {
    if (f.endsWith('.puml')) fs.rmSync(path.join(DIAGRAMS_DIR, f));
  }
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
