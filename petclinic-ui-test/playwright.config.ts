import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // After the suite, pull each test's trace from Tempo and render a PlantUML
  // sequence diagram (best-effort; never fails the run).
  globalTeardown: './tests/support/global-teardown.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['list']
  ],
  use: {
    // 127.0.0.1 (not "localhost") to avoid Node IPv6 (::1) resolution surprises.
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.SKIP_SERVER_START ? undefined : {
    command: 'npm run start:apps',
    port: 4200,
    timeout: 120000,
    reuseExistingServer: !process.env.CI,
  },
});
