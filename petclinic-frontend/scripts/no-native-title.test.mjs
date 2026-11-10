// The app has one tooltip (src/app/design-system/tooltip.ts, `data-tip="…"`). A native `title`
// is unstyled and shows ~500ms late, so this fails on any `title="` attribute or `.title =`.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join} from 'node:path';

const ROOT = new URL('../src/app/', import.meta.url).pathname;
const NATIVE_TITLE = /\stitle\s*=\s*"|\[(attr\.)?title\]\s*=|\.title\s*=[^=]/;

function sources(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === 'generated' ? [] : sources(path);
    }
    return /\.(html|ts)$/.test(name) && !name.endsWith('.spec.ts') ? [path] : [];
  });
}

test('no native title tooltips: use data-tip="…" instead', () => {
  const hits = sources(ROOT).flatMap(path => readFileSync(path, 'utf8').split('\n')
    .map((line, index) => ({path, line: index + 1, text: line.trim()}))
    .filter(({text}) => NATIVE_TITLE.test(text)));
  assert.deepEqual(hits.map(({path, line, text}) => `${path.replace(ROOT, 'src/app/')}:${line}  ${text}`), [],
    'Replace the native title with data-tip="…" (src/app/design-system/tooltip.ts)');
});
