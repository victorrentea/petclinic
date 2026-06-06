import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs';
import { resolve, relative, dirname, join, sep } from 'path';

const SRC_DIR = resolve(__dirname, '../../src');
const DIAGRAM_PATH = resolve(__dirname, '../../docs/packages.puml');

// These folders contain no domain logic worth tracking cross-package deps for
const EXCLUDED = new Set(['migrations', 'generated', 'app', 'common']);

const RELATIVE_IMPORT_RE = /from\s+['"](\.[^'"]+)['"]/g;

function getAllTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllTsFiles(full));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') && !entry.name.endsWith('.d.ts')) {
      results.push(full);
    }
  }
  return results;
}

function packageOf(filePath: string): string {
  const rel = relative(SRC_DIR, filePath);
  if (!rel.includes(sep)) return 'app'; // root-level files (app.module.ts, main.ts, data-source.ts)
  return rel.split(sep)[0];
}

export function buildDepsGraph(): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();

  for (const file of getAllTsFiles(SRC_DIR)) {
    const pkg = packageOf(file);
    if (EXCLUDED.has(pkg)) continue;
    if (!graph.has(pkg)) graph.set(pkg, new Set());

    const content = readFileSync(file, 'utf-8');
    const dir = dirname(file);

    for (const match of content.matchAll(RELATIVE_IMPORT_RE)) {
      const resolved = resolve(dir, match[1]);
      const relToSrc = relative(SRC_DIR, resolved);
      if (relToSrc.startsWith('..')) continue; // outside src/

      const targetPkg = packageOf(resolved);
      if (targetPkg !== pkg && !EXCLUDED.has(targetPkg)) {
        graph.get(pkg)!.add(targetPkg);
      }
    }
  }

  return graph;
}

export function generateDiagram(graph: Map<string, Set<string>>): string {
  const packages = [...graph.keys()].sort();
  const lines = [
    '@startuml',
    '',
    'title Package Dependencies',
    'caption Auto-generated from TypeScript imports. Update with: npm run guardrail:package-deps',
    '',
  ];

  for (const pkg of packages) {
    lines.push(`[${pkg}]`);
  }

  lines.push('');

  for (const pkg of packages) {
    for (const dep of [...(graph.get(pkg) || [])].sort()) {
      lines.push(`[${pkg}] --> [${dep}]`);
    }
  }

  lines.push('');
  lines.push('@enduml');
  lines.push('');

  return lines.join('\n');
}

function main() {
  const isCheck = process.argv.includes('--check');
  const generated = generateDiagram(buildDepsGraph());

  if (isCheck) {
    let committed: string;
    try {
      committed = readFileSync(DIAGRAM_PATH, 'utf-8');
    } catch {
      process.stderr.write('docs/packages.puml not found. Run: npm run guardrail:package-deps\n');
      process.exit(1);
    }
    if (generated !== committed) {
      process.stderr.write('docs/packages.puml is out of sync with actual TypeScript imports.\n');
      process.stderr.write('Run: cd petclinic-backend-ts && npm run guardrail:package-deps\n');
      process.exit(1);
    }
  } else {
    mkdirSync(dirname(DIAGRAM_PATH), { recursive: true });
    writeFileSync(DIAGRAM_PATH, generated, 'utf-8');
    process.stdout.write('Written: docs/packages.puml\n');
  }
}

if (require.main === module) {
  main();
}
