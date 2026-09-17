import {
  After, AfterAll, Before, BeforeAll, ITestCaseHookParameter,
  setDefaultTimeout, setWorldConstructor, World, IWorldOptions,
} from '@cucumber/cucumber';
import {Browser, BrowserContext, chromium, Page} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import {appendWindow, forgetWindowsOf} from './trace-window-store';
import {flushBrowserSpans} from './otel-flush';
import {shouldGenerateSequence} from '../genseq/sequence-tag';
import {runGenerate, CUCUMBER_SOURCES} from '../genseq/generate';

setDefaultTimeout(60_000);

const WINDOWS_DIR = path.join(__dirname, '..', '..', 'test-results', 'trace-windows');

// Playwright's own recording of each scenario — screenshots, DOM snapshots, console,
// network — the same zip `trace: 'on'` leaves behind for a *.spec.ts. Cucumber runs
// outside Playwright's test runner, so nothing records one unless this file does, and
// nothing files it in an HTML report either: each scenario gets its zip and a sidecar
// JSON naming the test it is of (title, feature file, line, status), which is what
// /human-review harvests next to the spec traces (human-review.json, steps.traces.cucumber).
// The same switch as playwright.config.ts, so one `PW_TRACE=on` records both suites.
const TRACES_DIR = path.join(__dirname, '..', '..', 'test-results', 'cucumber-traces');
const TRACE_ON = process.env.PW_TRACE === 'on';

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
  // Set by the owner-search scenarios: every owner the API knows, displayed as
  // the grid shows them ("LastName, FirstName").
  allOwnerNames?: string[];
  // Set by the owner-search pagination scenario: the owners shown on the page
  // just navigated away from, to check the next page doesn't repeat them.
  previousPageOwnerNames?: string[];
  // Set by the visit-date-range scenarios (bug #40).
  bugFortyBackgroundToday?: Date;
  bugFortyBackgroundBirth?: Date;
  bugFortyPetBirthDate?: Date;
  bugFortyVisitDate?: string;
  // Set only for @generate_sequence scenarios: the title + start of the Tempo
  // search window whose traces become a sequence diagram.
  traceTitle?: string;
  traceSource?: string;
  traceStartMs?: number;
  // Set for every scenario when PW_TRACE=on: where its recording lands, and when it began.
  recordingZip?: string;
  recordingStartMs?: number;

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
  // A clean slate per run, like the report the Playwright suite rewrites: a recording
  // of a scenario that no longer exists must not outlive the run that made it.
  if (TRACE_ON) {
    fs.rmSync(TRACES_DIR, {recursive: true, force: true});
    fs.mkdirSync(TRACES_DIR, {recursive: true});
  }
});

Before(async function (this: PlaywrightWorld, {pickle}: ITestCaseHookParameter) {
  this.browser = await chromium.launch({headless: !process.env.HEADED});
  this.context = await this.browser.newContext({baseURL: process.env.BASE_URL || 'http://localhost:4200'});
  if (TRACE_ON) {
    await this.context.tracing.start({screenshots: true, snapshots: true, sources: true, title: pickle.name});
    this.recordingZip = path.join(TRACES_DIR, recordingSlug(pickle.uri, pickle.name) + '.zip');
    this.recordingStartMs = Date.now();
  }
  this.page = await this.context.newPage();

  if (shouldGenerateSequence(pickle.tags)) {
    this.traceTitle = pickle.name;
    this.traceSource = path.relative(path.join(__dirname, '..', '..'), pickle.uri);
    // Stamp every browser span with the scenario name so Tempo can find this
    // run via `{ span.test.name = "..." }`.
    await this.page.addInitScript((name) => {
      (globalThis as any).__E2E_TEST_NAME__ = name;
    }, pickle.name);
    this.traceStartMs = Date.now() - PRE_PAD_MS;
  }
});

After(async function (this: PlaywrightWorld, {pickle, gherkinDocument, result}: ITestCaseHookParameter) {
  if (this.recordingZip) {
    await this.context?.tracing.stop({path: this.recordingZip});
    const scenario = gherkinDocument.feature?.children
      .map(c => c.scenario)
      .find(sc => sc && pickle.astNodeIds.includes(sc.id));
    const sidecar = {
      title: pickle.name,
      path: gherkinDocument.feature ? [gherkinDocument.feature.name] : [],
      file: path.relative(path.join(__dirname, '..', '..'), pickle.uri),
      line: scenario?.location.line ?? null,
      status: (result?.status ?? 'unknown').toLowerCase(),
      duration: Date.now() - (this.recordingStartMs ?? Date.now()),
      error: (result?.message ?? '').split('\n').find(l => l.trim()) ?? '',
      trace: path.basename(this.recordingZip),
    };
    fs.writeFileSync(this.recordingZip.replace(/\.zip$/, '.json'), JSON.stringify(sidecar, null, 2));
  }
  if (this.traceTitle && this.traceStartMs !== undefined) {
    await flushBrowserSpans(this.page);
    appendWindow(WINDOWS_DIR, {
      title: this.traceTitle,
      source: this.traceSource!,
      startMs: this.traceStartMs,
      endMs: Date.now() + POST_PAD_MS,
    });
  }
  await this.context?.close();
  await this.browser?.close();
});

// One file per scenario, named so a human can find it and short enough for any disk:
// the feature's basename, then the scenario, lower-cased and dashed.
function recordingSlug(uri: string, name: string): string {
  const feature = path.basename(uri, '.feature');
  return `${feature}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

// Render a PlantUML sequence diagram for each recorded window. Best-effort:
// Only this suite's diagrams: the Playwright windows in the same file are there so a
// standalone `npm run diagram` can re-render every diagram, not for this run to rewrite.
// runGenerate() never throws, so a telemetry hiccup can't fail the suite.
AfterAll(async function () {
  await runGenerate(CUCUMBER_SOURCES);
});
