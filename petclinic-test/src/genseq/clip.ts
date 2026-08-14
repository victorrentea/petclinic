// Both label renderers cap how much of one value reaches a diagram; the cap itself
// is the same idea in both places, so it lives here once.

export const ELLIPSIS = '…';

/** The first `max` lines, the last of which becomes an ellipsis when anything was dropped. */
export function capLines(lines: string[], max: number): string[] {
  if (lines.length <= max) return lines;
  return [...lines.slice(0, max - 1), ELLIPSIS];
}
