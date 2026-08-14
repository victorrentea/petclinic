import * as fs from 'fs';
import * as path from 'path';
import {TestWindow} from '../seqgen/generate';

/** Same scenario re-run in the same file replaces its window; titles may repeat across files. */
export function mergeWindow(existing: TestWindow[], entry: TestWindow): TestWindow[] {
  const kept = existing.filter((w) => w.title !== entry.title || w.source !== entry.source);
  return [...kept, entry];
}

export function appendWindow(file: string, entry: TestWindow): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const existing: TestWindow[] = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, 'utf-8'))
    : [];
  fs.writeFileSync(file, JSON.stringify(mergeWindow(existing, entry), null, 2));
}
