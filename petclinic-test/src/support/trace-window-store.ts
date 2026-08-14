import * as fs from 'fs';
import * as path from 'path';
import {TestWindow} from '../seqgen/generate';

/** Same scenario re-run in the same file replaces its window; titles may repeat across files. */
export function mergeWindow(existing: TestWindow[], entry: TestWindow): TestWindow[] {
  const kept = existing.filter((w) => w.title !== entry.title || w.source !== entry.source);
  return [...kept, entry];
}

/** The windows a runner does not own — what it must leave behind for the other suite. */
export function windowsNotOwnedBy(existing: TestWindow[], ownedSources: RegExp): TestWindow[] {
  return existing.filter((w) => !ownedSources.test(w.source));
}

// A runner starts by forgetting *its own* windows, not every window: the file is
// also what `npm run diagram` replays to re-render at another detail level, and
// wiping it whole would silently shrink that to whichever suite ran last.
export function forgetWindowsOf(file: string, ownedSources: RegExp): void {
  if (!fs.existsSync(file)) return;
  const existing: TestWindow[] = JSON.parse(fs.readFileSync(file, 'utf-8'));
  fs.writeFileSync(file, JSON.stringify(windowsNotOwnedBy(existing, ownedSources), null, 2));
}

export function appendWindow(file: string, entry: TestWindow): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const existing: TestWindow[] = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, 'utf-8'))
    : [];
  fs.writeFileSync(file, JSON.stringify(mergeWindow(existing, entry), null, 2));
}
