// A REST arrow says which endpoint was called; the payload says what was
// actually asked for and answered. Drawn as a PlantUML note, so it reads as
// data attached to the call rather than as part of the call's name.

const MAX_LINES = 14;
const MAX_CHARS_PER_LINE = 90;
const ELLIPSIS = '…';

function clipWidth(line: string): string {
  return line.length <= MAX_CHARS_PER_LINE
    ? line
    : `${line.slice(0, MAX_CHARS_PER_LINE)}${ELLIPSIS}`;
}

/** The payload as note lines: pretty-printed when it parses, clipped either way. */
export function formatJsonLines(body: string): string[] {
  const trimmed = body.trim();
  if (!trimmed) return [];

  let text = trimmed;
  try {
    text = JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    // not JSON (a plain-text or already-truncated body) — show it as it came
  }

  const lines = text.split('\n').map(clipWidth);
  if (lines.length <= MAX_LINES) return lines;
  return [...lines.slice(0, MAX_LINES - 1), ELLIPSIS];
}

/** A `note over A, B` block carrying the payload, or nothing when there is none. */
export function jsonNote(participants: string, body: string | undefined): string[] {
  const lines = body ? formatJsonLines(body) : [];
  if (lines.length === 0) return [];
  return [`note over ${participants}`, ...lines, 'end note'];
}
