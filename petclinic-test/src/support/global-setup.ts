import * as path from 'path';
import {forgetWindowsOf} from './trace-window-store';

// Forget the windows of the tests this runner owns (*.spec.ts), so global-teardown
// regenerates their diagrams from this run alone. The Cucumber suite's windows stay
// on file: they are what a later `npm run diagram` replays to re-render every
// diagram at another detail level. Mirrors world.ts's BeforeAll.
export default async function globalSetup(): Promise<void> {
  forgetWindowsOf(
    path.join(__dirname, '..', '..', 'test-results', 'trace-windows.json'),
    /\.spec\.ts$/,
  );
}
