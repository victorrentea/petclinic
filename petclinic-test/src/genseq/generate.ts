import * as fs from 'fs';
import * as path from 'path';
import {readWindows} from '../support/trace-window-store';
import {parseTempoTrace, renderDiagram, DiagramScenario, NormSpan} from './trace-to-puml';
import {StepMark} from './steps';
import {scenarioLine} from './scenario-line';
import {tempoConfigFromEnv, searchTraceIds, getTrace} from './tempo-client';
import {DEFAULT_DIAGRAM_OPTIONS, DiagramOptions, describeOptions, optionsFromEnv} from './options';

export interface TestWindow {
  title: string;
  /** The file the scenario is written in — 'add-visit.spec.ts', 'owner-search.feature'. */
  source: string;
  startMs: number;
  endMs: number;
  /**
   * The sentences the scenario walked through, in order, each stamped when it started —
   * what turns a wall of HTTP arrows back into the test that caused them. Optional: a
   * window written before this existed still renders, just without the narration.
   */
  steps?: StepMark[];
}

/** What a re-render needs: no Tempo, no clock — only somewhere to write and to log. */
export interface RenderDeps {
  writeFile: (filePath: string, content: string) => void;
  /** Optional: lets a run merge into the span cache instead of replacing it. */
  readFile?: (filePath: string) => string | undefined;
  /** Optional: without it, re-rendering at a level with nothing to reveal leaves the
   *  previous level's sidecar behind, claiming a detail the picture no longer offers. */
  removeFile?: (filePath: string) => void;
  log: (msg: string) => void;
}

export interface GenerateDeps extends RenderDeps {
  searchTraceIds: (traceql: string, startMs: number, endMs: number) => Promise<string[]>;
  getTrace: (traceId: string) => Promise<unknown>;
  sleep?: (ms: number) => Promise<void>;
}

/** One source file's scenarios, as fetched from Tempo — the input a re-render replays. */
export interface CachedSource {
  source: string;
  scenarios: DiagramScenario[];
}

// Tempo ingests asynchronously, so a search fired the instant the suite ends
// routinely comes back empty for traces that land a second or two later.
export interface RetryOptions {
  attempts?: number;
  delayMs?: number;
}

const DEFAULT_ATTEMPTS = 8;
const DEFAULT_DELAY_MS = 2_000;

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function searchWithRetry(
  traceql: string, w: TestWindow, deps: GenerateDeps, retry: RetryOptions,
): Promise<string[]> {
  const attempts = retry.attempts ?? DEFAULT_ATTEMPTS;
  const delayMs = retry.delayMs ?? DEFAULT_DELAY_MS;
  const pause = deps.sleep ?? sleep;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const ids = await deps.searchTraceIds(traceql, w.startMs, w.endMs);
    if (ids.length > 0) return ids;
    if (attempt < attempts) await pause(delayMs);
  }
  return [];
}

/**
 * The spans behind the last fetch, kept so a re-render needs nothing running.
 * Tempo is queried once, when the tests run; every later `npm run diagram*` replays
 * this file — which is what makes switching detail level a sub-second, offline switch.
 */
export function spanCachePathFor(rootDir: string): string {
  return `${rootDir}/test-results/trace-spans.json`;
}

/** The diagram sits next to its test, named after it: owner-search.feature.genseq.puml */
export function diagramPathFor(rootDir: string, source: string): string {
  return `${rootDir}/${source}.genseq.puml`;
}

/**
 * What the diagram's markers reveal, beside the diagram: owner-search.feature.genseq.json.
 * A sidecar rather than comments inside the .puml — a payload is arbitrary text, and
 * smuggling it through PlantUML's comment syntax is an escaping problem nobody needs.
 */
export function detailsPathFor(rootDir: string, source: string): string {
  return `${rootDir}/${source}.genseq.json`;
}

/**
 * Tempo returns a scenario's traces newest-first; a scenario is several traces (one
 * per browser interaction) and the diagram's whole claim is that it shows the order
 * they happened in. Spans are already sorted *within* a trace — this sorts the traces
 * against each other, which is what made a POST render before the GET that preceded it.
 *
 * Ordered by the earliest *server* span, not by the earliest span of any kind: a
 * browser root span opens when the interaction starts and stays open across the
 * navigation that follows, so its start time can precede the request by a wide margin
 * (measured: 146ms, enough to sort a POST ahead of two GETs that really came first).
 * The backend spans all come from one JVM clock, which is the only clock here that can
 * be compared across traces.
 */
function chronological(traces: NormSpan[][]): NormSpan[][] {
  const startOf = (spans: NormSpan[]) => {
    const serverSide = spans.filter((s) => s.serviceName !== 'petclinic-frontend');
    // a trace with no server span at all (a lone click) can only be placed by its own clock
    return Math.min(...(serverSide.length > 0 ? serverSide : spans).map((s) => s.startNano));
  };
  return [...traces].sort((a, b) => startOf(a) - startOf(b));
}

/** What the cache already holds, or nothing when it is absent, unreadable or not wired. */
function readSpanCache(file: string, deps: GenerateDeps): CachedSource[] {
  try {
    const raw = deps.readFile?.(file);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** `fresh` wins for the sources it covers; every other source keeps what it had. */
export function mergeCachedSources(
  cached: CachedSource[], fresh: CachedSource[],
): CachedSource[] {
  const replaced = new Set(fresh.map((c) => c.source));
  return [...cached.filter((c) => !replaced.has(c.source)), ...fresh]
    .sort((a, b) => a.source.localeCompare(b.source));
}

function groupBySource(windows: TestWindow[]): Map<string, TestWindow[]> {
  const bySource = new Map<string, TestWindow[]>();
  for (const w of windows) {
    const group = bySource.get(w.source) ?? [];
    group.push(w);
    bySource.set(w.source, group);
  }
  return bySource;
}

export async function generateFromWindows(
  windows: TestWindow[], rootDir: string, deps: GenerateDeps, retry: RetryOptions = {},
  options: DiagramOptions = DEFAULT_DIAGRAM_OPTIONS,
): Promise<string[]> {
  const fetched: CachedSource[] = [];
  // One diagram per source file, one section per scenario in it — so the picture
  // is filed where its test is, and reads in the order the file does.
  for (const [source, group] of groupBySource(windows)) {
    const scenarios: DiagramScenario[] = [];
    for (const w of group) {
      // JSON.stringify, not interpolation: a scenario titled `Search for "Potter"`
      // would otherwise close the TraceQL string early and Tempo would 400.
      const traceql = `{ span.test.name = ${JSON.stringify(w.title)} }`;
      try {
        const ids = await searchWithRetry(traceql, w, deps, retry);
        if (ids.length === 0) {
          deps.log(`⏭️  "${w.title}": no traces in window — skipped`);
          continue;
        }
        const traces: NormSpan[][] = [];
        for (const id of ids) {
          traces.push(parseTempoTrace(await deps.getTrace(id)));
        }
        scenarios.push({title: w.title, traces: chronological(traces), steps: w.steps});
        deps.log(`✅ "${w.title}": ${ids.length} trace(s)`);
      } catch (err) {
        // One scenario's Tempo error must not cost every other diagram — the runner
        // deletes them all up front, so an abort here leaves fewer on disk than it found.
        deps.log(`⚠️  "${w.title}": ${(err as Error).message} — skipped`);
      }
    }
    if (scenarios.length === 0) continue;
    fetched.push({source, scenarios});
  }

  if (fetched.length > 0) {
    // Merge, never replace. Each runner fetches only the sources it owns, so writing
    // `fetched` over the cache left it holding whichever suite ran last — and a later
    // `npm run diagram` then re-rendered *that* suite's diagrams and quietly none of the
    // others. The same trap the windows store is built to avoid, in its sibling cache.
    deps.writeFile(spanCachePathFor(rootDir),
      JSON.stringify(mergeCachedSources(readSpanCache(spanCachePathFor(rootDir), deps), fetched)));
  }
  return renderScenarios(fetched, rootDir, deps, options);
}

/** Draw the diagrams from spans already in hand — the offline half of the pipeline. */
export function renderScenarios(
  sources: CachedSource[], rootDir: string, deps: RenderDeps,
  options: DiagramOptions = DEFAULT_DIAGRAM_OPTIONS,
): string[] {
  const written: string[] = [];
  for (const {source, scenarios} of sources) {
    const filePath = diagramPathFor(rootDir, source);
    const {puml, details} = renderDiagram(source, located(scenarios, source, rootDir, deps), options);
    deps.writeFile(filePath, puml);
    deps.log(`📊 ${source}: ${scenarios.length} scenario(s) → ${filePath}`);
    // Only the .puml paths are returned: the sidecar is part of one diagram, not
    // another one, and every caller counts what it gets back as "diagrams".
    written.push(filePath);
    const revealed = Object.keys(details.details).length;
    const detailsPath = detailsPathFor(rootDir, source);
    if (revealed > 0) {
      deps.writeFile(detailsPath, `${JSON.stringify(details, null, 2)}\n`);
      deps.log(`   🔍 ${revealed} revealable arrow(s) → ${detailsPath}`);
    } else {
      deps.removeFile?.(detailsPath);
    }
  }
  return written;
}

/**
 * Each scenario with the line it is written on, so its section header can link back to it.
 *
 * Read here rather than carried in the span cache: re-rendering an older run's spans must
 * point at where the scenario is *now*. A file that cannot be read — a diagram whose test was
 * deleted, or one being rendered somewhere the sources are not checked out — simply yields no
 * lines, and every section renders as the plain text it always did.
 */
function located(
  scenarios: DiagramScenario[], source: string, rootDir: string, deps: RenderDeps,
): DiagramScenario[] {
  const text = deps.readFile?.(`${rootDir}/${source}`);
  if (text === undefined) return scenarios;
  return scenarios.map((s) => ({...s, line: scenarioLine(source, s.title, text)}));
}

/**
 * Which sources a run owns. A runner regenerates only its own diagrams — the windows
 * file holds both suites' entries so that a standalone `npm run diagram` can re-render
 * everything, and without this filter a plain `npm test` would rewrite the Cucumber
 * diagrams from the *previous* Cucumber run's windows.
 */
export const PLAYWRIGHT_SOURCES = /\.spec\.ts$/;
export const CUCUMBER_SOURCES = /\.feature$/;
/** A @SpringBootTest carrying @GenerateSequence; its windows are written from the JVM. */
export const JAVA_SOURCES = /\.java$/;

// Maven cannot call runGenerate() with an argument the way the two Node runners do, so the
// backend's run-tests-with-tracing.sh names its suite here instead. Without it a post-test
// `npm run diagram` would take the no-owner path — replay the cache — and never go to
// Tempo for the traces the Java run has just produced.
const OWNED_SOURCES: Record<string, RegExp> = {
  playwright: PLAYWRIGHT_SOURCES,
  cucumber: CUCUMBER_SOURCES,
  java: JAVA_SOURCES,
};

export function ownedSourcesFromEnv(
  env: Record<string, string | undefined> = process.env,
): RegExp | undefined {
  return OWNED_SOURCES[env.GENSEQ_SUITE?.trim().toLowerCase() ?? ''];
}

export async function runGenerate(owned?: RegExp): Promise<void> {
  const ownedSources = owned ?? ownedSourcesFromEnv();
  const root = path.join(__dirname, '..', '..');
  const windowsDir = path.join(root, 'test-results', 'trace-windows');
  const options = optionsFromEnv();
  console.log(`🎚️  Detail: ${describeOptions(options)}`);

  // A standalone re-render (npm run diagram*) replays the cached spans: no Grafana,
  // no backend, no test run — just the detail level you asked for. A test run always
  // goes to Tempo instead (it owns fresh traces), and GENSEQ_REFRESH=1 forces that
  // path by hand when the cache is stale.
  const cacheFile = spanCachePathFor(root);
  if (!ownedSources && !process.env.GENSEQ_REFRESH && fs.existsSync(cacheFile)) {
    const cached: CachedSource[] = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    const paths = renderScenarios(cached, root, {
      writeFile: (p, c) => fs.writeFileSync(p, c),
      readFile: (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : undefined),
      removeFile: (p) => fs.rmSync(p, {force: true}),
      log: (m) => console.log(m),
    }, options);
    console.log(`📊 Re-rendered ${paths.length} diagram(s) from ${cacheFile} — Grafana not needed`);
    return;
  }

  if (!fs.existsSync(windowsDir)) {
    console.warn(`ℹ️  ${windowsDir} not found — no diagrams generated.`);
    return;
  }

  // Everything below is inside the guard: both hooks that call this document that it
  // never throws, and a telemetry-only problem must never fail a whole suite.
  try {
    const all: TestWindow[] = readWindows(windowsDir);
    const windows = ownedSources ? all.filter((w) => ownedSources.test(w.source ?? '')) : all;
    if (windows.length === 0) {
      console.log('ℹ️  No trace windows for this runner — no diagrams generated.');
      return;
    }

    const cfg = tempoConfigFromEnv();
    const deps: GenerateDeps = {
      searchTraceIds: (q, s, e) => searchTraceIds(cfg, q, s, e),
      getTrace: (id) => getTrace(cfg, id),
      writeFile: (p, c) => fs.writeFileSync(p, c),
      readFile: (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : undefined),
      removeFile: (p) => fs.rmSync(p, {force: true}),
      log: (m) => console.log(m),
    };

    // Each window deliberately ends a few seconds in the *future* (the pad that
    // covers the exporters' async flush), so searching the moment the suite
    // finishes would query a window that has not closed yet.
    const settleMs = Math.max(...windows.map((w) => w.endMs)) - Date.now();
    if (settleMs > 0) {
      console.log(`⏳ Waiting ${(settleMs / 1000).toFixed(1)}s for the last trace window to close…`);
      await sleep(settleMs);
    }

    const paths = await generateFromWindows(windows, root, deps, {}, options);
    console.log(`📊 Generated ${paths.length} diagram(s)`);
  } catch (err) {
    console.warn(`⚠️  Diagram generation failed (continuing): ${(err as Error).message}`);
  }
}

if (require.main === module) {
  void runGenerate();
}
