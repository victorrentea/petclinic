import {test as base} from '@playwright/test';
import * as path from 'path';
import {appendWindow} from './trace-window-store';
import {flushBrowserSpans} from './otel-flush';
import {isTagged, shouldGenerateSequence} from '../genseq/sequence-tag';
import {startTestCoverage, stopTestCoverage} from './coverage';

// The Playwright counterpart of src/glue/world.ts: it honours the very same
// @generate_sequence opt-in, only read from Playwright's test tags instead of
// Cucumber's scenario tags — and the same GENSEQ_SELECT list of tests named without
// a tag (genseq/sequence-tag.ts). Any other test runs normally and records no trace
// window, so no .puml is produced for it.

const WINDOWS_DIR = path.join(__dirname, '..', '..', 'test-results', 'trace-windows');

// Pads the recorded window so the BatchSpanProcessor's async export (and Tempo
// ingestion lag) still falls inside the search range.
const PRE_PAD_MS = 1_000;
const POST_PAD_MS = 5_000;

export const test = base.extend({
  page: async ({page}, use, testInfo) => {
    // Per-test coverage for /human-review (support/coverage.ts). Inert without
    // COVERAGE_DIR; around the body so a traced test and an untraced one are measured alike.
    await startTestCoverage(page);
    const harvest = () => stopTestCoverage(page, {
      suite: 'playwright',
      id: `${path.relative(path.join(__dirname, '..', '..'), testInfo.file)}:${testInfo.line}`,
      title: testInfo.titlePath.slice(1).join(' > '),
      file: path.relative(path.join(__dirname, '..', '..'), testInfo.file),
      line: testInfo.line,
      status: testInfo.status ?? 'unknown',
    });
    if (!shouldGenerateSequence(testInfo.tags, testInfo.title, testInfo.file)) {
      await use(page);
      await harvest();
      return;
    }
    // Stamp every browser span with the test name so Tempo can find this run
    // via `{ span.test.name = "..." }`.
    await page.addInitScript((name) => {
      // globalThis === window in the browser; using it keeps this typecheck-clean
      // under the Node lib (no 'dom') and matches how otel.ts reads the global.
      (globalThis as any).__E2E_TEST_NAME__ = name;
    }, testInfo.title);

    const startMs = Date.now() - PRE_PAD_MS;
    await use(page);
    await harvest();
    await flushBrowserSpans(page);
    appendWindow(WINDOWS_DIR, {
      title: testInfo.title,
      source: path.relative(path.join(__dirname, '..', '..'), testInfo.file),
      startMs,
      endMs: Date.now() + POST_PAD_MS,
      // Named by GENSEQ_SELECT, untagged: the diagram's footer must not claim a tag.
      ...(isTagged(testInfo.tags) ? {} : {selected: true}),
    });
  },
});

export {expect} from '@playwright/test';
