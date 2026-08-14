import * as fs from 'fs';
import * as path from 'path';
import {parseTempoTrace, renderPuml, DiagramScenario, NormSpan} from './trace-to-puml';
import {tempoConfigFromEnv, searchTraceIds, getTrace} from './tempo-client';
import {DEFAULT_DIAGRAM_OPTIONS, DiagramOptions, describeOptions, optionsFromEnv} from './options';

export interface TestWindow {
  title: string;
  /** The file the scenario is written in — 'add-visit.spec.ts', 'owner-search.feature'. */
  source: string;
  startMs: number;
  endMs: number;
}

/** What a re-render needs: no Tempo, no clock — only somewhere to write and to log. */
export interface RenderDeps {
  writeFile: (filePath: string, content: string) => void;
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
        scenarios.push({title: w.title, traces: chronological(traces)});
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
    deps.writeFile(spanCachePathFor(rootDir), JSON.stringify(fetched));
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
    deps.writeFile(filePath, renderPuml(source, scenarios, options));
    deps.log(`📊 ${source}: ${scenarios.length} scenario(s) → ${filePath}`);
    written.push(filePath);
  }
  return written;
}

/**
 * Which sources a run owns. A runner regenerates only its own diagrams — the windows
 * file holds both suites' entries so that a standalone `npm run diagram` can re-render
 * everything, and without this filter a plain `npm test` would rewrite the Cucumber
 * diagrams from the *previous* Cucumber run's windows.
 */
export const PLAYWRIGHT_SOURCES = /\.spec\.ts$/;
export const CUCUMBER_SOURCES = /\.feature$/;

export async function runGenerate(ownedSources?: RegExp): Promise<void> {
  const root = path.join(__dirname, '..', '..');
  const windowsFile = path.join(root, 'test-results', 'trace-windows.json');
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
      log: (m) => console.log(m),
    }, options);
    console.log(`📊 Re-rendered ${paths.length} diagram(s) from ${cacheFile} — Grafana not needed`);
    return;
  }

  if (!fs.existsSync(windowsFile)) {
    console.warn(`ℹ️  ${windowsFile} not found — no diagrams generated.`);
    return;
  }

  // Everything below is inside the guard: both hooks that call this document that it
  // never throws, and a run killed mid-write leaves a windows file that JSON.parse
  // rejects — which would fail a whole suite for a telemetry-only reason.
  try {
    const all: TestWindow[] = JSON.parse(fs.readFileSync(windowsFile, 'utf-8'));
    const windows = ownedSources ? all.filter((w) => ownedSources.test(w.source)) : all;
    if (windows.length === 0) {
      console.log('ℹ️  No trace windows for this runner — no diagrams generated.');
      return;
    }

    const cfg = tempoConfigFromEnv();
    const deps: GenerateDeps = {
      searchTraceIds: (q, s, e) => searchTraceIds(cfg, q, s, e),
      getTrace: (id) => getTrace(cfg, id),
      writeFile: (p, c) => fs.writeFileSync(p, c),
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
