import {Page} from '@playwright/test';

// The browser batches spans and only exports them every ~5s, but a test runner
// closes the page the instant the last assertion passes — so without this the
// spans of the very interaction under test are dropped before they leave the
// browser, Tempo finds nothing, and no .puml is generated.
//
// The grace period matters just as much as the flush: the XHR/fetch
// instrumentation ends a request span *asynchronously*, once the matching
// PerformanceResourceTiming entry shows up. Flushing the moment the assertion
// passes therefore exports the `click` span but not the `GET` span under it —
// which is exactly the arrow (Browser -> Backend) the sequence diagram is for.
const SPAN_END_GRACE_MS = 1_000;

// petclinic-frontend/src/otel.ts publishes __OTEL_FLUSH__ once the provider is
// registered; it is absent when telemetry is disabled (no collector running).
export async function flushBrowserSpans(page: Page): Promise<void> {
  try {
    await page.waitForTimeout(SPAN_END_GRACE_MS);
    await page.evaluate(() => (globalThis as any).__OTEL_FLUSH__?.());
  } catch {
    // Page already closed/crashed, or the app never loaded — nothing to drain.
  }
}
