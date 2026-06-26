import { test, expect } from '@playwright/test';
import { mergeWindow } from '../../tests/support/trace-window-store';

test('mergeWindow appends a new title', () => {
  const out = mergeWindow([], { title: 'a', startMs: 1, endMs: 2 });
  expect(out).toEqual([{ title: 'a', startMs: 1, endMs: 2 }]);
});

test('mergeWindow replaces an existing same-title entry', () => {
  const out = mergeWindow(
    [{ title: 'a', startMs: 1, endMs: 2 }],
    { title: 'a', startMs: 9, endMs: 10 },
  );
  expect(out).toEqual([{ title: 'a', startMs: 9, endMs: 10 }]);
});
