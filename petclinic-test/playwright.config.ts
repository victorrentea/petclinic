import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
  testDir: './src',
  // src/genseq/*.spec.ts are pure unit tests for the diagram tooling — no browser,
  // no running stack. They have their own runner: playwright.unit.config.ts.
  testIgnore: '**/genseq/**',
  // After the suite, pull each tagged test's trace from Tempo and render a
  // PlantUML sequence diagram (best-effort; never fails the run).
  globalSetup: './src/support/global-setup.ts',
  globalTeardown: './src/support/global-teardown.ts',
  // Everything a run produces lives under test-results/ — the HTML report next
  // to the per-test artifacts, not in a second top-level folder. They must not
  // nest: the HTML reporter wipes its own folder before writing.
  outputDir: './test-results/artifacts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // One worker under COVERAGE_DIR as well: per-test coverage dumps the backend's one global
  // set of counters after each test, and two tests running at once would share a dump
  // (src/support/coverage.ts).
  workers: process.env.CI || process.env.COVERAGE_DIR ? 1 : undefined,
  reporter: [
    ['html', {outputFolder: 'test-results/playwright-report'}],
    ['list'],
  ],
  use: {
    // 127.0.0.1 (not "localhost") to avoid Node IPv6 (::1) resolution surprises.
    // Requires the dev server to actually listen on IPv4: angular.json pins
    // serve.options.host to 127.0.0.1, since ng's default ("localhost") resolves
    // to ::1 on macOS and would bind IPv6-only — refusing every request here.
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:4200',
    // `on-first-retry` is the right default for CI, and it is why a green local run
    // records nothing at all. `PW_TRACE=on` is how a run that is meant to be *read*
    // asks for a trace per test: /human-review harvests them out of the HTML report
    // below and carries them onto the review page, where the Tests tab steps through
    // each one (human-review.json, steps.traces).
    trace: (process.env.PW_TRACE as 'on' | 'off' | 'on-first-retry') || 'on-first-retry',
    screenshot: 'only-on-failure',
    // Failures are the only videos worth keeping in a normal run. `PW_VIDEO=on` exists for
    // review-time recording (.claude/skills/human-review/scripts/record-feature-video.sh), where the point is to film a
    // scenario that PASSES — the acceptance test itself becomes the demo of the feature.
    video: (process.env.PW_VIDEO as 'on' | 'off' | 'retain-on-failure') || 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {...devices['Desktop Chrome']},
    },
  ],
  webServer: process.env.SKIP_SERVER_START ? undefined : {
    command: 'npm run start:apps',
    port: 4200,
    timeout: 120000,
    reuseExistingServer: !process.env.CI,
  },
});
