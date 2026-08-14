import {test, expect} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import {slugify, generateFromWindows, TestWindow, GenerateDeps} from './generate';

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
    [{ title: 'Empty', startMs: 0, endMs: 1 }], '/out', deps, { attempts: 1 },
  );
  expect(paths).toEqual([]);
  expect(logs.join('\n')).toContain('no traces');
});

// Tempo ingests asynchronously: a search fired the instant the suite ends
// routinely returns nothing for traces that show up a second or two later.
test('generateFromWindows retries a window until Tempo has ingested it', async () => {
  const slept: number[] = [];
  let searches = 0;
  const deps: GenerateDeps = {
    searchTraceIds: async () => (++searches < 3 ? [] : ['t1']),
    getTrace: async () => fixture,
    writeFile: () => {},
    log: () => {},
    sleep: async (ms) => { slept.push(ms); },
  };
  const paths = await generateFromWindows(
    [{ title: 'Add a visit', startMs: 0, endMs: 1 }], '/out', deps,
    { attempts: 5, delayMs: 250 },
  );
  expect(searches).toBe(3);
  expect(slept).toEqual([250, 250]);
  expect(paths).toEqual(['/out/add-a-visit.puml']);
});

test('generateFromWindows gives up after the configured number of attempts', async () => {
  let searches = 0;
  const deps: GenerateDeps = {
    searchTraceIds: async () => { searches++; return []; },
    getTrace: async () => { throw new Error('should not be called'); },
    writeFile: () => { throw new Error('should not write'); },
    log: () => {},
    sleep: async () => {},
  };
  const paths = await generateFromWindows(
    [{ title: 'Empty', startMs: 0, endMs: 1 }], '/out', deps, { attempts: 4, delayMs: 1 },
  );
  expect(searches).toBe(4);
  expect(paths).toEqual([]);
});
