import {defineConfig} from '@playwright/test';

// Pure (non-browser) unit tests for the trace-diagram tooling. Separate from
// playwright.config.ts (which targets ./src and starts a web server).
export default defineConfig({
  testDir: './scripts/trace-diagram',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
});
