import * as fs from 'fs';
import * as path from 'path';
import {parseTempoTrace, renderPuml, NormSpan} from './trace-to-puml';
import {tempoConfigFromEnv, searchTraceIds, getTrace} from './tempo-client';

export interface TestWindow {
  title: string;
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

export async function generateFromWindows(
  windows: TestWindow[], outDir: string, deps: GenerateDeps, retry: RetryOptions = {},
): Promise<string[]> {
  const written: string[] = [];
  for (const w of windows) {
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
    const slug = slugify(w.title);
    const filePath = `${outDir}/${slug}.puml`;
    const puml = renderPuml(w.title, traces);
    deps.writeFile(filePath, puml);
    deps.log(`✅ "${w.title}": ${ids.length} trace(s) → ${filePath}`);
    written.push(filePath);
  }
  return written;
}

export async function runGenerate(): Promise<void> {
  const root = path.join(__dirname, '..', '..');
  const windowsFile = path.join(root, 'test-results', 'trace-windows.json');
  const outDir = path.join(root, 'generated_sequences');

  if (!fs.existsSync(windowsFile)) {
    console.warn(`ℹ️  ${windowsFile} not found — no diagrams generated.`);
    return;
  }
  const windows: TestWindow[] = JSON.parse(fs.readFileSync(windowsFile, 'utf-8'));
  fs.mkdirSync(outDir, { recursive: true });

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

  try {
    const paths = await generateFromWindows(windows, outDir, deps);
    console.log(`📊 Generated ${paths.length} diagram(s) in ${outDir}`);
  } catch (err) {
    console.warn(`⚠️  Diagram generation failed (continuing): ${(err as Error).message}`);
  }
}

if (require.main === module) {
  void runGenerate();
}
