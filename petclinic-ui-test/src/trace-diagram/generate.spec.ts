import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { slugify, generateFromWindows, TestWindow, GenerateDeps } from './generate';

const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '__fixtures__', 'add-visit-trace.json'), 'utf-8'),
);

test('slugify makes filesystem-safe names', () => {
  expect(slugify('Add a visit!')).toBe('add-a-visit');
});

test('generateFromWindows writes one puml per test that has traces', async () => {
  const written: Record<string, string> = {};
  const deps: GenerateDeps = {
    searchTraceIds: async () => ['t1'],
    getTrace: async () => fixture,
    writeFile: (p, c) => { written[p] = c; },
    log: () => {},
  };
  const windows: TestWindow[] = [{ title: 'Add a visit', startMs: 0, endMs: 10_000 }];
  const paths = await generateFromWindows(windows, '/out', deps);
  expect(paths).toEqual(['/out/add-a-visit.puml']);
  expect(written['/out/add-a-visit.puml']).toContain('Browser -> Backend: POST /api/visits');
});

test('generateFromWindows skips (no throw) when a test has zero traces', async () => {
  const logs: string[] = [];
  const deps: GenerateDeps = {
    searchTraceIds: async () => [],
    getTrace: async () => { throw new Error('should not be called'); },
    writeFile: () => { throw new Error('should not write'); },
    log: (m) => logs.push(m),
  };
  const paths = await generateFromWindows(
    [{ title: 'Empty', startMs: 0, endMs: 1 }], '/out', deps,
  );
  expect(paths).toEqual([]);
  expect(logs.join('\n')).toContain('no traces');
});
