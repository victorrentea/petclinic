import {
  After, AfterAll, AfterStep, Before, BeforeAll, BeforeStep, ITestCaseHookParameter, ITestStepHookParameter,
  setDefaultTimeout, setWorldConstructor, World, IWorldOptions,
} from '@cucumber/cucumber';
import {Browser, BrowserContext, chromium, Page} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import {appendWindow, forgetWindowsOf} from './trace-window-store';
import {flushBrowserSpans} from './otel-flush';
import {shouldGenerateSequence} from '../genseq/sequence-tag';
import {runGenerate, CUCUMBER_SOURCES} from '../genseq/generate';
import {startCoverageRun, startTestCoverage, stopTestCoverage} from './coverage';
import {keepCaptionAcrossLoads, showCaption} from './captions';

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

// A video per scenario, subtitled with its Gherkin steps (support/captions.ts), slowed
// down so a room can follow it: `PW_VIDEO=on npm run test:cucumber`. Same switch name
// as playwright.config.ts; PW_SLOWMO overrides the pace (ms per browser action).
const VIDEOS_DIR = path.join(__dirname, '..', '..', 'test-results', 'cucumber-videos');
const VIDEO_ON = process.env.PW_VIDEO === 'on';
const VIDEO_SIZE = {width: 1280, height: 800};

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
  petName?: string;
  visitDescription?: string;
  // Set by the owner-search scenarios: every owner the API knows, by full name, in name order.
  allOwnerNames?: string[];
  // The full names the grid showed while paging through it, in the order shown.
  listedOwnerNames?: string[];
  // Set only for @generate_sequence scenarios: the title + start of the Tempo
  // search window whose traces become a sequence diagram.
  traceTitle?: string;
  traceSource?: string;
  traceStartMs?: number;
  // Set for every scenario when PW_TRACE=on: where its recording lands, and when it began.
  recordingZip?: string;
  recordingStartMs?: number;
  // Set when PW_VIDEO=on: the subtitle currently on screen.
  caption?: string;

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
  // Per-test coverage for /human-review (support/coverage.ts): a clean folder per run.
  startCoverageRun('cucumber');
  // A clean slate per run, like the report the Playwright suite rewrites: a recording
  // of a scenario that no longer exists must not outlive the run that made it.
  if (TRACE_ON) {
    fs.rmSync(TRACES_DIR, {recursive: true, force: true});
    fs.mkdirSync(TRACES_DIR, {recursive: true});
  }
});

Before(async function (this: PlaywrightWorld, {pickle}: ITestCaseHookParameter) {
  this.browser = await chromium.launch({
    headless: !process.env.HEADED,
    slowMo: VIDEO_ON ? Number(process.env.PW_SLOWMO ?? 400) : undefined,
  });
  this.context = await this.browser.newContext({
    baseURL: process.env.BASE_URL || 'http://localhost:4200',
    ...(VIDEO_ON && {viewport: VIDEO_SIZE, recordVideo: {dir: VIDEOS_DIR, size: VIDEO_SIZE}}),
  });
  if (TRACE_ON) {
    await this.context.tracing.start({screenshots: true, snapshots: true, sources: true, title: pickle.name});
    this.recordingZip = path.join(TRACES_DIR, recordingSlug(pickle.uri, pickle.name) + '.zip');
    this.recordingStartMs = Date.now();
  }
  this.page = await this.context.newPage();
  if (VIDEO_ON) {
    keepCaptionAcrossLoads(this.page, () => this.caption);
  }
  await startTestCoverage(this.page);

  // Tagged, or named by GENSEQ_SELECT (sequence-tag.ts) — the scenarios a branch wrote.
  if (shouldGenerateSequence(pickle.tags, pickle.name, pickle.uri)) {
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
  const outline = gherkinDocument.feature?.children
    .map(c => c.scenario)
    .find(sc => sc && pickle.astNodeIds.includes(sc.id));
  const line = outline?.location.line ?? null;
  // A Scenario Outline is one scenario line and one pickle per Examples row, usually all
  // under the same name: the row's own line is what tells them apart.
  const row = outline?.examples.flatMap(e => e.tableBody)
    .find(r => pickle.astNodeIds.includes(r.id))?.location.line;
  const file = path.relative(path.join(__dirname, '..', '..'), pickle.uri);
  await stopTestCoverage(this.page, {
    suite: 'cucumber',
    id: `${file}:${row ?? line}`,
    title: pickle.name,
    file,
    line,
    status: (result?.status ?? 'unknown').toLowerCase(),
  });
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
  const video = this.page?.video();
  await this.context?.close();
  if (video) {
    await video.saveAs(path.join(VIDEOS_DIR, recordingSlug(pickle.uri, pickle.name) + '.webm'));
    await video.delete();
  }
  await this.browser?.close();
});

BeforeStep(async function (this: PlaywrightWorld, {pickleStep}: ITestStepHookParameter) {
  if (!VIDEO_ON) return;
  const keywords: Record<string, string> = {Context: 'Given', Action: 'When', Outcome: 'Then'};
  const keyword = keywords[pickleStep.type ?? ''] ?? '';
  this.caption = `${keyword} ${pickleStep.text}`.trim();
  await showCaption(this.page, this.caption);
  await this.page.waitForTimeout(1_200); // time to read it before the step acts
});

AfterStep(async function (this: PlaywrightWorld, {result}: ITestStepHookParameter) {
  if (!VIDEO_ON) return;
  const failed = result.status !== 'PASSED';
  const verdict = failed ? `❌ FAILED: ${this.caption}` : `✅ ${this.caption}`;
  await showCaption(this.page, verdict, failed ? 'fail' : 'pass');
  this.caption = undefined;
  await this.page.waitForTimeout(failed ? 3_500 : 900);
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
