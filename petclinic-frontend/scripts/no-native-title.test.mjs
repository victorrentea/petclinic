// The app has one tooltip (src/app/design-system/tooltip.ts). A native `title` cannot be styled and
// shows after ~500ms, and it creeps back one hurried usage at a time - so it is refused here,
// in both its forms: the attribute in a template and the property assigned in code.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const FRONTEND = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(FRONTEND, 'src/app');
const NATIVE_TITLE = [
  {pattern: /\stitle="/, fix: 'use data-tip="…" (or data-tip-truncated on a cut-off cell)'},
  {pattern: /\[(attr\.)?title\]=/, fix: 'bind [attr.data-tip] instead'},
  {pattern: /\.title\s*=[^=]/, fix: 'set the data-tip attribute instead'},
];

function* sources(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== 'generated') yield* sources(path);
    } else if (/\.(html|ts)$/.test(name) && !name.endsWith('.spec.ts')) {
      yield path;
    }
  }
}

test('no native title tooltip anywhere in the app', () => {
  const hits = [];
  for (const file of sources(APP)) {
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      for (const {pattern, fix} of NATIVE_TITLE) {
        if (pattern.test(line)) hits.push(`${relative(FRONTEND, file)}:${i + 1}: ${line.trim()}  →  ${fix}`);
      }
    });
  }
  assert.deepEqual(hits, [], `Native title tooltips found:\n${hits.join('\n')}`);
});
