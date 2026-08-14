// A REST arrow says which endpoint was called; the payload says what was
// actually asked for and answered. Drawn as a PlantUML note, so it reads as
// data attached to the call rather than as part of the call's name.

import {capLines, ELLIPSIS} from './clip';

const MAX_LINES = 14;
const MAX_CHARS_PER_LINE = 90;

/** A line PlantUML would read as syntax rather than as note content. */
const NOTE_SYNTAX_RE = /^\s*(end\s*note|@enduml|@startuml)\s*$/i;

function wrap(line: string): string[] {
  if (line.length <= MAX_CHARS_PER_LINE) return [line];
  const parts: string[] = [];
  for (let at = 0; at < line.length; at += MAX_CHARS_PER_LINE) {
    parts.push(line.slice(at, at + MAX_CHARS_PER_LINE));
  }
  return parts;
}

/** The payload as note lines: pretty-printed when it parses, clipped either way. */
export function formatJsonLines(body: string): string[] {
  const trimmed = body.trim();
  if (!trimmed) return [];

  let text = trimmed;
  try {
    text = JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    // Not JSON — a plain-text body, or one the browser truncated at its own cap,
    // which lands here as a single enormous line. Wrapping rather than clipping it
    // to one line is what keeps a too-large payload showing its shape.
  }

  return capLines(text.split('\n').flatMap(wrap), MAX_LINES);
}

/** A `note over A, B` block carrying the payload, or nothing when there is none. */
export function jsonNote(participants: string, body: string | undefined): string[] {
  const lines = body ? formatJsonLines(body) : [];
  if (lines.length === 0) return [];
  // A payload line reading "end note" would otherwise close the block early and
  // leave a stray terminator behind — the whole file then fails to render.
  const safe = lines.map((l) => (NOTE_SYNTAX_RE.test(l) ? `${l} ${ELLIPSIS}` : l));
  return [`note over ${participants}`, ...safe, 'end note'];
}
