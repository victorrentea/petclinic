#!/usr/bin/env node
/*
 * The app has one tooltip (design-system/tooltip.service.ts, opted into with
 * `data-tip`). The native `title` cannot be styled, cannot be resized, and appears
 * after ~500ms — long enough that the reader gives up first.
 *
 * Without a check this stays a convention, and conventions erode additively: one
 * native tooltip added in a hurry never looks broken enough to trigger a cleanup.
 *
 * Both spellings are caught. `.title =` is the one that survives audits, because
 * people grep for `title="` and never for the assignment.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'src', 'app');
const SKIP_DIRS = new Set(['generated', 'node_modules']);
const OFFENDERS = [
  {re: /\stitle\s*=\s*"/, what: 'title="…" attribute'},
  {re: /\.title\s*=\s*['"`]/, what: '.title = "…" assignment'},
];

const hits = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name));
      continue;
    }
    if (!/\.(html|ts)$/.test(entry.name) || entry.name.endsWith('.spec.ts')) continue;
    const file = path.join(dir, entry.name);
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      for (const {re, what} of OFFENDERS) {
        if (re.test(line)) hits.push({file: path.relative(ROOT, file), line: i + 1, what, text: line.trim()});
      }
    });
  }
})(ROOT);

if (hits.length) {
  console.error('\nNative browser tooltips found. Use data-tip="…" instead:\n');
  for (const h of hits) console.error(`  ${h.file}:${h.line}  ${h.what}\n      ${h.text}`);
  console.error('\n  Why: the native title cannot be styled and appears after ~500ms.');
  console.error('  Fix: replace with data-tip="…" (or [data-tip]="expr"), from DesignSystemModule.\n');
  process.exit(1);
}
console.log('✓ no native title tooltips');
