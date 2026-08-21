import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {TestWindow} from '../genseq/generate';

// One file per window, never one file for all of them.
//
// This used to be a single `trace-windows.json` that every writer read, edited and wrote
// back. Playwright runs its scenarios in parallel workers, so two of them would open the
// file for writing at the same time: both truncate, both write from offset 0, and the
// shorter document lands inside the longer one. The next reader then dies on
// `SyntaxError: Unexpected end of JSON input` and the scenario loses its diagram — the
// failure that made a traced run silently produce three diagrams instead of four. The
// same interleaving loses updates even when it does not corrupt: two workers both read
// state S and the second write erases the first one's window.
//
// A lock would make the read-modify-write safe. Giving each window its own file makes
// there be no read-modify-write: a writer only ever creates the file named after the
// scenario it just ran, and no two scenarios share a name. Nothing to race over, nothing
// to leave half-written, and a crashed worker costs its own window rather than the file.

/** Same scenario re-run in the same file replaces its window; titles may repeat across files. */
export function windowFileName(entry: Pick<TestWindow, 'title' | 'source'>): string {
  const key = `${entry.source ?? ''}::${entry.title}`;
  return `${crypto.createHash('sha1').update(key).digest('hex').slice(0, 16)}.json`;
}

/** The windows a runner does not own — what it must leave behind for the other suite. */
export function windowsNotOwnedBy(existing: TestWindow[], ownedSources: RegExp): TestWindow[] {
  return existing.filter((w) => !ownedSources.test(w.source ?? ''));
}

/** Every window on file, oldest scenario first, skipping anything unreadable. */
export function readWindows(dir: string): TestWindow[] {
  if (!fs.existsSync(dir)) return [];
  const windows: TestWindow[] = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith('.json')) continue;
    try {
      windows.push(JSON.parse(fs.readFileSync(path.join(dir, name), 'utf-8')));
    } catch {
      // A worker killed mid-write leaves one unreadable window. That costs one diagram;
      // throwing here would cost every diagram, which is the bug this replaced.
      fs.rmSync(path.join(dir, name), {force: true});
    }
  }
  return windows.sort((a, b) => a.startMs - b.startMs);
}

// A runner starts by forgetting *its own* windows, not every window: the store is also
// what `npm run diagram` replays to re-render at another detail level, and wiping it
// whole would silently shrink that to whichever suite ran last.
export function forgetWindowsOf(dir: string, ownedSources: RegExp): void {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    const file = path.join(dir, name);
    let window: TestWindow;
    try {
      window = JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch {
      fs.rmSync(file, {force: true}); // unreadable: nobody can own it, nobody wants it
      continue;
    }
    // A window with no source predates this field and can never be matched by an owner
    // pattern, so it would otherwise outlive every run that tried to forget it.
    if (window.source === undefined || ownedSources.test(window.source)) {
      fs.rmSync(file, {force: true});
    }
  }
}

/** Record one scenario's window. Writers never touch a file another writer owns. */
export function appendWindow(dir: string, entry: TestWindow): void {
  fs.mkdirSync(dir, {recursive: true});
  const file = path.join(dir, windowFileName(entry));
  // Written via a uniquely-named temp file and renamed into place: rename is atomic, so
  // a reader sees either the previous window or this one, never a half-written document.
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(entry, null, 2));
  fs.renameSync(temp, file);
}
