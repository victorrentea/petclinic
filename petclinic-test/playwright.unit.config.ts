import {defineConfig} from '@playwright/test';

// Pure (non-browser) unit tests for the trace-diagram tooling. Separate from
// playwright.config.ts (which targets ./src and starts a web server).
export default defineConfig({
  testDir: './src/genseq',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  // Playwright wipes its output directory before every run, and the default is
  // test-results/ itself — which is where trace-windows.json lives. Running the unit
  // tests would otherwise delete the record `npm run diagram` replays, so re-rendering
  // a diagram at another detail level would need a whole new e2e run.
  outputDir: './test-results/unit',
});
