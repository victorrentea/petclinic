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

/**
 * A body the browser cut at its own byte cap ends mid-token, so it parses as nothing —
 * and the payloads big enough to be clipped are exactly the ones worth pretty-printing.
 * Cut back to the last complete member instead, close the containers that were still
 * open, and let it parse.
 */
function repairClipped(text: string): string | null {
  const stack: string[] = [];
  let lastComplete = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{' || c === '[') stack.push(c === '{' ? '}' : ']');
    else if (c === '}' || c === ']') stack.pop();
    else if (c === ',' && stack.length > 0) lastComplete = i;
  }

  if (lastComplete < 0 || stack.length === 0) return null;
  const closers = stack.slice().reverse().join('');
  return text.slice(0, lastComplete) + closers;
}

interface Pretty {
  text: string;
  /** The browser cut this body at its own cap and it had to be closed to parse. */
  repaired: boolean;
}

function prettify(body: string): Pretty | null {
  const trimmed = body.trim();
  if (!trimmed) return null;

  try {
    return {text: JSON.stringify(JSON.parse(trimmed), null, 2), repaired: false};
  } catch {
    const patched = repairClipped(trimmed);
    if (patched !== null) {
      try {
        return {text: JSON.stringify(JSON.parse(patched), null, 2), repaired: true};
      } catch {
        // Still not JSON — a plain-text body. Wrapping rather than clipping it to one
        // line is what keeps a too-large payload showing its shape.
      }
    }
    return {text: trimmed, repaired: false};
  }
}

/** The payload as note lines: pretty-printed when it parses, clipped either way. */
export function formatJsonLines(body: string): string[] {
  const pretty = prettify(body);
  if (!pretty) return [];

  const lines = pretty.text.split('\n').flatMap(wrap);
  if (pretty.repaired) lines.push(ELLIPSIS);
  return capLines(lines, MAX_LINES);
}

/**
 * The whole payload, pretty-printed and neither wrapped nor clipped — for the panel
 * a reader clicks open, which scrolls in both directions. Empty when there is no body.
 */
export function formatJsonDetail(body: string | undefined): string {
  const pretty = prettify(body ?? '');
  if (!pretty) return '';
  return pretty.repaired ? `${pretty.text}\n${ELLIPSIS} clipped by the browser at its 4 KB cap` : pretty.text;
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
