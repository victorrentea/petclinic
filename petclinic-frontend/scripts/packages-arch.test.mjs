// The frontend twin of the backend's PackagesArchTest: docs/frontend-packages.puml is the
// allowed dependency picture, and the code may not import across boxes the picture does not
// connect. An arrow nobody uses does not fail, as in ArchUnit. Zero dependencies on purpose.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const FRONTEND = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIAGRAM = 'docs/frontend-packages.puml';
const APP = 'src/app';

const toPosix = p => p.split(sep).join('/');
const rel = abs => toPosix(relative(FRONTEND, abs));
const isProduction = file => file.endsWith('.ts') && !file.endsWith('.spec.ts') && !file.endsWith('.d.ts');

function parseDiagram() {
  const boxes = new Map(); // label -> folder relative to petclinic-frontend/
  const arrows = new Set(); // "from->to"
  for (const raw of readFileSync(join(FRONTEND, DIAGRAM), 'utf8').split('\n')) {
    const line = raw.trim();
    if (line.startsWith("'")) continue;
    const box = line.match(/^\[([^\]]+)\]\s*(?:as\s+\S+\s*)?<<([^>]+)>>/);
    if (box) boxes.set(box[1], box[2].trim().replace(/\/$/, ''));
    // [a] --> [b], [a] -up-> [b], [a] <--> [b] (both ways); [a] -[hidden]-> [b] is layout only
    const arrow = line.match(/^\[([^\]]+)\]\s*(<?[-.]\S*?[-.]>?)\s*\[([^\]]+)\]/);
    if (arrow && !arrow[2].includes('hidden')) {
      const [, from, shaft, to] = arrow;
      if (shaft.endsWith('>')) arrows.add(`${from}->${to}`);
      if (shaft.startsWith('<')) arrows.add(`${to}->${from}`);
    }
  }
  return {boxes, arrows};
}

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** The box whose folder is the deepest one containing the file, or undefined. */
function boxOf(file, boxes) {
  let best;
  for (const [label, folder] of boxes) {
    if ((file === folder || file.startsWith(folder + '/')) && (!best || folder.length > best.folder.length)) {
      best = {label, folder};
    }
  }
  return best?.label;
}

/** Resolves a relative specifier as TypeScript would: file.ts, then folder/index.ts. */
function resolveImport(fromFile, specifier) {
  const base = resolve(FRONTEND, dirname(fromFile), specifier);
  for (const candidate of [base, `${base}.ts`, join(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return rel(candidate);
  }
  if (existsSync(base) && statSync(base).isDirectory()) return rel(base); // a folder with no barrel
  return undefined;
}

function relativeImports(source) {
  const found = [];
  const pattern = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"]*)\1/g;
  for (const match of source.matchAll(pattern)) {
    found.push({specifier: match[2], line: source.slice(0, match.index).split('\n').length});
  }
  return found;
}

const {boxes, arrows} = parseDiagram();
const files = walk(join(FRONTEND, APP)).map(rel).filter(isProduction);

test(`every cross-box import is an arrow in ${DIAGRAM}`, () => {
  const violations = [];
  for (const file of files) {
    const fromBox = boxOf(file, boxes);
    for (const {specifier, line} of relativeImports(readFileSync(join(FRONTEND, file), 'utf8'))) {
      const target = resolveImport(file, specifier);
      if (!target) {
        violations.push(`${file}:${line} imports '${specifier}', which resolves to no file`);
        continue;
      }
      if (!target.startsWith(APP + '/')) continue; // ../environments etc. are outside the picture
      const toBox = boxOf(target, boxes);
      if (fromBox && toBox && fromBox !== toBox && !arrows.has(`${fromBox}->${toBox}`)) {
        violations.push(`${file}:${line} → ${target}  needs the arrow [${fromBox}] --> [${toBox}]`);
      }
    }
  }
  assert.ok(violations.length === 0, `\n${violations.length} import(s) not drawn in ${DIAGRAM}:\n  `
    + violations.join('\n  ') + '\nDraw the arrow if the dependency is intended, or remove the import.\n');
});

test(`every production .ts file under ${APP} is in a box`, () => {
  const orphans = files.filter(file => !boxOf(file, boxes));
  assert.ok(orphans.length === 0, `\nFiles in no box of ${DIAGRAM}:\n  ${orphans.join('\n  ')}\n`);
});

test(`the boxes of ${DIAGRAM} are exactly the folders of ${APP}`, () => {
  const problems = [];
  for (const [label, folder] of boxes) {
    if (!files.some(file => file.startsWith(folder + '/'))) {
      problems.push(`box [${label}] <<${folder}>>: no production .ts file in that folder`);
    }
  }
  const boxed = new Set(boxes.values());
  const topFolders = new Set(files.map(file => file.slice(APP.length + 1).split('/'))
    .filter(parts => parts.length > 1).map(parts => `${APP}/${parts[0]}`));
  for (const folder of [APP, ...topFolders]) {
    if (!boxed.has(folder)) {
      problems.push(`folder ${folder} has no box: add [${folder.split('/').pop()}] <<${folder}>>`);
    }
  }
  assert.ok(problems.length === 0, `\nThe diagram and ${APP} disagree:\n  ${problems.join('\n  ')}\n`);
});
