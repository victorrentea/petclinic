import * as fs from 'fs';
import * as path from 'path';
import { TestWindow } from '../../src/trace-diagram/generate';

export function mergeWindow(existing: TestWindow[], entry: TestWindow): TestWindow[] {
  const kept = existing.filter((w) => w.title !== entry.title);
  return [...kept, entry];
}

export function appendWindow(file: string, entry: TestWindow): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const existing: TestWindow[] = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, 'utf-8'))
    : [];
  fs.writeFileSync(file, JSON.stringify(mergeWindow(existing, entry), null, 2));
}
