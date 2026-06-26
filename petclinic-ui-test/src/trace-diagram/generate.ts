import * as fs from 'fs';
import * as path from 'path';
import { parseTempoTrace, renderPuml, NormSpan } from './trace-to-puml';
import { tempoConfigFromEnv, searchTraceIds, getTrace } from './tempo-client';

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
}

export function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export async function generateFromWindows(
  windows: TestWindow[], outDir: string, deps: GenerateDeps,
): Promise<string[]> {
  const written: string[] = [];
  for (const w of windows) {
    const traceql = `{ span.test.name = "${w.title}" }`;
    const ids = await deps.searchTraceIds(traceql, w.startMs, w.endMs);
    if (ids.length === 0) {
      deps.log(`⏭️  "${w.title}": no traces in window — skipped`);
      continue;
    }
    const traces: NormSpan[][] = [];
    for (const id of ids) {
      traces.push(parseTempoTrace(await deps.getTrace(id)));
    }
    const puml = renderPuml(w.title, traces);
    const filePath = `${outDir}/${slugify(w.title)}.puml`;
    deps.writeFile(filePath, puml);
    deps.log(`✅ "${w.title}": ${ids.length} trace(s) → ${filePath}`);
    written.push(filePath);
  }
  return written;
}

export async function runGenerate(): Promise<void> {
  const root = path.join(__dirname, '..', '..');
  const windowsFile = path.join(root, 'test-results', 'trace-windows.json');
  const outDir = path.join(root, 'diagrams');

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
