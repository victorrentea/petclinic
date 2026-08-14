import {runGenerate, PLAYWRIGHT_SOURCES} from '../seqgen/generate';

// Runs after the whole Playwright suite. Regenerates only the diagrams of the specs
// this runner owns: the windows file also holds the Cucumber suite's entries, so that
// a standalone `npm run diagram` can re-render everything at another detail level.
// runGenerate() never throws; any failure is logged and swallowed so a telemetry
// hiccup can't fail the test run.
export default async function globalTeardown(): Promise<void> {
  await runGenerate(PLAYWRIGHT_SOURCES);
}
