import { test as base } from '@playwright/test';
import * as path from 'path';
import { appendWindow } from './trace-window-store';

const WINDOWS_FILE = path.join(__dirname, '..', '..', 'test-results', 'trace-windows.json');

// Pads the recorded window so the BatchSpanProcessor's async export (and Tempo
// ingestion lag) still falls inside the search range.
const PRE_PAD_MS = 1_000;
const POST_PAD_MS = 5_000;

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    await page.addInitScript((name) => {
      // globalThis === window in the browser; using it keeps this typecheck-clean
      // under the Node lib (no 'dom') and matches how otel.ts reads the global.
      (globalThis as any).__E2E_TEST_NAME__ = name;
    }, testInfo.title);

    const startMs = Date.now() - PRE_PAD_MS;
    await use(page);
    const endMs = Date.now() + POST_PAD_MS;

    appendWindow(WINDOWS_FILE, { title: testInfo.title, startMs, endMs });
  },
});

export { expect } from '@playwright/test';
