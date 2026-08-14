import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
  testDir: './src',
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
  workers: process.env.CI ? 1 : undefined,
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
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
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
