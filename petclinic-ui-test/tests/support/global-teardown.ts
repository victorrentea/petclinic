import { runGenerate } from '../../src/trace-diagram/generate';

// Runs after the whole Playwright suite. runGenerate() never throws; any failure
// is logged and swallowed so a telemetry hiccup can't fail the test run.
export default async function globalTeardown(): Promise<void> {
  await runGenerate();
}
