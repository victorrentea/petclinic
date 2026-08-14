import * as fs from 'fs';
import * as path from 'path';

// Drop the previous run's recorded windows, so global-teardown regenerates
// diagrams only for tests that just ran — otherwise a window left behind by the
// Cucumber suite is searched again here, and a diagram nobody asked for is
// either rewritten or reported as skipped. Mirrors world.ts's BeforeAll.
export default async function globalSetup(): Promise<void> {
  fs.rmSync(path.join(__dirname, '..', '..', 'test-results', 'trace-windows.json'), {force: true});
}
