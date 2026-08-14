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

export interface GenerateDeps {
  searchTraceIds: (traceql: string, startMs: number, endMs: number) => Promise<string[]>;
  getTrace: (traceId: string) => Promise<unknown>;
  writeFile: (filePath: string, content: string) => void;
  log: (msg: string) => void;
  sleep?: (ms: number) => Promise<void>;
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

/** The diagram sits next to its test, named after it: owner-search.feature.seqgen.puml */
export function diagramPathFor(rootDir: string, source: string): string {
  return `${rootDir}/${source}.seqgen.puml`;
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
  const written: string[] = [];
  // One diagram per source file, one section per scenario in it — so the picture
  // is filed where its test is, and reads in the order the file does.
  for (const [source, group] of groupBySource(windows)) {
    const scenarios: DiagramScenario[] = [];
    for (const w of group) {
      const traceql = `{ span.test.name = "${w.title}" }`;
      const ids = await searchWithRetry(traceql, w, deps, retry);
      if (ids.length === 0) {
        deps.log(`⏭️  "${w.title}": no traces in window — skipped`);
        continue;
      }
      const traces: NormSpan[][] = [];
      for (const id of ids) {
        traces.push(parseTempoTrace(await deps.getTrace(id)));
      }
      scenarios.push({title: w.title, traces});
      deps.log(`✅ "${w.title}": ${ids.length} trace(s)`);
    }
    if (scenarios.length === 0) continue;

    const filePath = diagramPathFor(rootDir, source);
    deps.writeFile(filePath, renderPuml(source, scenarios, options));
    deps.log(`📊 ${source}: ${scenarios.length} scenario(s) → ${filePath}`);
    written.push(filePath);
  }
  return written;
}

export async function runGenerate(): Promise<void> {
  const root = path.join(__dirname, '..', '..');
  const windowsFile = path.join(root, 'test-results', 'trace-windows.json');

  if (!fs.existsSync(windowsFile)) {
    console.warn(`ℹ️  ${windowsFile} not found — no diagrams generated.`);
    return;
  }
  const windows: TestWindow[] = JSON.parse(fs.readFileSync(windowsFile, 'utf-8'));

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

  const options = optionsFromEnv();
  console.log(`🎚️  Detail: ${describeOptions(options)}`);

  try {
    const paths = await generateFromWindows(windows, root, deps, {}, options);
    console.log(`📊 Generated ${paths.length} diagram(s)`);
  } catch (err) {
    console.warn(`⚠️  Diagram generation failed (continuing): ${(err as Error).message}`);
  }
}

if (require.main === module) {
  void runGenerate();
}
