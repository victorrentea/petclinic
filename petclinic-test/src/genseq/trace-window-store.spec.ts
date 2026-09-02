import {test, expect} from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  appendWindow, forgetWindowsOf, readWindows, windowFileName, windowsNotOwnedBy,
} from '../support/trace-window-store';

const scratch = () => fs.mkdtempSync(path.join(os.tmpdir(), 'windows-'));

const visit = {title: 'Add a visit', source: 'src/add-visit.spec.ts', startMs: 1, endMs: 2};
const search = {title: 'Search owners', source: 'src/owner-search.feature', startMs: 3, endMs: 4};

test('a window round-trips through the store', () => {
  const dir = scratch();
  appendWindow(dir, visit);
  expect(readWindows(dir)).toEqual([visit]);
});

// Each runner forgets only what it owns, so the store stays the record of *both*
// suites — which is what a standalone `npm run diagram` replays.
test('a runner forgets its own windows and keeps the other suite\'s', () => {
  expect(windowsNotOwnedBy([visit, search], /\.spec\.ts$/)).toEqual([search]);
  expect(windowsNotOwnedBy([visit, search], /\.feature$/)).toEqual([visit]);

  const dir = scratch();
  appendWindow(dir, visit);
  appendWindow(dir, search);
  forgetWindowsOf(dir, /\.spec\.ts$/);
  expect(readWindows(dir)).toEqual([search]);
});

test('re-running a scenario replaces its window rather than adding one', () => {
  const dir = scratch();
  appendWindow(dir, visit);
  appendWindow(dir, {...visit, startMs: 9, endMs: 10});
  expect(readWindows(dir)).toEqual([{...visit, startMs: 9, endMs: 10}]);
});

// The whole reason for a file per window: Playwright runs scenarios in parallel
// workers, and a shared document meant two of them truncating and writing over each
// other — losing a window at best, corrupting the file at worst.
test('two scenarios never write to the same file', () => {
  expect(windowFileName(visit)).not.toBe(windowFileName(search));
  // same title in two different files is two different scenarios
  expect(windowFileName({title: 'x', source: 'a.spec.ts'}))
    .not.toBe(windowFileName({title: 'x', source: 'b.feature'}));
  const {startMs, endMs, ...identity} = visit;
  expect(windowFileName(visit)).toBe(windowFileName(identity));
});

// A worker killed mid-write used to take every diagram down with it, because one
// unparseable document was the whole store.
test('an unreadable window costs only itself', () => {
  const dir = scratch();
  appendWindow(dir, visit);
  fs.writeFileSync(path.join(dir, 'torn.json'), '[{"title": "half a doc"');
  expect(readWindows(dir)).toEqual([visit]);
});

// Windows written before `source` existed match no owner pattern, so they used to
// survive every attempt to forget them and re-render into diagrams forever.
test('a window with no source is forgotten rather than kept for ever', () => {
  const dir = scratch();
  appendWindow(dir, {title: 'ancient', startMs: 1, endMs: 2} as any);
  forgetWindowsOf(dir, /\.spec\.ts$/);
  expect(readWindows(dir)).toEqual([]);
});

test('windows come back in the order the scenarios ran', () => {
  const dir = scratch();
  appendWindow(dir, search);
  appendWindow(dir, visit);
  expect(readWindows(dir).map((w) => w.title)).toEqual(['Add a visit', 'Search owners']);
});
