import {test as base} from '@playwright/test';
import * as path from 'path';
import {appendWindow} from './trace-window-store';
import {flushBrowserSpans} from './otel-flush';
import {shouldGenerateSequence} from '../seqgen/sequence-tag';

// The Playwright counterpart of src/glue/world.ts: it honours the very same
// @generate_sequence opt-in, only read from Playwright's test tags instead of
// Cucumber's scenario tags. Untagged tests run normally and record no trace
// window, so no .puml is produced for them.

const WINDOWS_FILE = path.join(__dirname, '..', '..', 'test-results', 'trace-windows.json');

// Pads the recorded window so the BatchSpanProcessor's async export (and Tempo
// ingestion lag) still falls inside the search range.
const PRE_PAD_MS = 1_000;
const POST_PAD_MS = 5_000;

export const test = base.extend({
  page: async ({page}, use, testInfo) => {
    if (!shouldGenerateSequence(testInfo.tags)) {
      await use(page);
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
    await flushBrowserSpans(page);
    appendWindow(WINDOWS_FILE, {
      title: testInfo.title,
      source: path.relative(path.join(__dirname, '..', '..'), testInfo.file),
      startMs,
      endMs: Date.now() + POST_PAD_MS,
    });
  },
});

export {expect} from '@playwright/test';
