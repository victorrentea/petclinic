import {test, expect} from '@playwright/test';
import {mergeWindow, windowsNotOwnedBy} from '../support/trace-window-store';

test('mergeWindow appends a new title', () => {
  const out = mergeWindow([], { title: 'a', startMs: 1, endMs: 2 });
  expect(out).toEqual([{ title: 'a', startMs: 1, endMs: 2 }]);
});

// Each runner forgets only what it owns, so the windows file stays the record of
// *both* suites — which is what a standalone `npm run diagram` replays.
test('a runner forgets its own windows and keeps the other suite\'s', () => {
  const windows = [
    {title: 'Add a visit', source: 'src/add-visit.spec.ts', startMs: 1, endMs: 2},
    {title: 'Search owners', source: 'src/owner-search.feature', startMs: 3, endMs: 4},
  ];
  expect(windowsNotOwnedBy(windows, /\.spec\.ts$/)).toEqual([windows[1]]);
  expect(windowsNotOwnedBy(windows, /\.feature$/)).toEqual([windows[0]]);
});

test('mergeWindow replaces an existing same-title entry', () => {
  const out = mergeWindow(
    [{ title: 'a', startMs: 1, endMs: 2 }],
    { title: 'a', startMs: 9, endMs: 10 },
  );
  expect(out).toEqual([{ title: 'a', startMs: 9, endMs: 10 }]);
});
