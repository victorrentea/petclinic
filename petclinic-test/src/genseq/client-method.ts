import type {CallFrame} from './call-site';
import type {ReadSource} from './code-location';
import {triggerOf} from './call-site';

/**
 * Which frontend method a browser request was made through: `OwnerService.getOwnerById`.
 *
 * The diagram draws it as a call arriving on the Browser lifeline from the left edge, the
 * request leaving from inside its activation, the way a repository call on the Backend fires
 * its queries (Victor, 10 Nov 2026). The stack cannot say it: `http.get` is a cold Observable, so the
 * service method has returned by the time the request leaves, and the top application frame
 * is the component's `.subscribe(` (see call-site.ts). The source can.
 *
 * From the line that subscribed, the statement it ends is read back, and every
 * `this.<field>.<method>(` in it whose field is typed with a class this app imports is a
 * candidate; a statement that subscribes to a local (`owners$.subscribe(`) is followed to
 * the assignment that filled it. One candidate is the answer. Several — `lastName ?
 * searchOwners(…) : getOwners()` — are told apart by the request itself: the HTTP verb the
 * method's body calls, then which of its string literals the URL carries (`'?lastName='`).
 *
 * No answer is still a name, never a guess: the component method the line sits in
 * (`OwnerListComponent.searchByLastName`), or else the file and line.
 */

/** The request as the browser's CLIENT span recorded it. */
export interface SentRequest {
  verb?: string;
  url?: string;
}

/** Blanks strings and comments, keeping every offset, so a scan never matches inside one. */
export function maskSource(source: string): string {
  let out = '';
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    let end = i + 1;
    if (ch === '/' && next === '/') {
      end = source.indexOf('\n', i);
      if (end < 0) end = source.length;
    } else if (ch === '/' && next === '*') {
      end = source.indexOf('*/', i + 2);
      end = end < 0 ? source.length : end + 2;
    } else if (ch === '\'' || ch === '"' || ch === '`') {
      end = i + 1;
      while (end < source.length && source[end] !== ch) end += source[end] === '\\' ? 2 : 1;
      end = Math.min(end + 1, source.length);
      out += ch + source.slice(i + 1, end - 1).replace(/[^\n]/g, ' ') + (end - 1 > i ? ch : '');
      i = end;
      continue;
    } else {
      out += ch;
      i++;
      continue;
    }
    out += source.slice(i, end).replace(/[^\n]/g, ' ');
    i = end;
  }
  return out;
}

/** Offset of the first character of a 1-based line. */
function offsetOfLine(source: string, line: number): number {
  let at = 0;
  for (let n = 1; n < line && at >= 0; n++) at = source.indexOf('\n', at) + 1;
  return at;
}

/**
 * Where the statement that `at` sits in begins: walking back over balanced brackets, it is
 * the character after a `;` or an unmatched opening bracket — the `{` of the function body
 * or the `(` of the callback the statement is nested in.
 */
function statementStart(masked: string, at: number): number {
  let depth = 0;
  for (let i = at - 1; i >= 0; i--) {
    const ch = masked[i];
    if (ch === ')' || ch === ']' || ch === '}') depth++;
    else if (ch === '(' || ch === '[' || ch === '{') {
      if (depth === 0) return i + 1;
      depth--;
    } else if (ch === ';' && depth === 0) return i + 1;
  }
  return 0;
}

/** Where the statement starting at `from` ends: its `;` or the bracket that closes around it. */
function statementEnd(masked: string, from: number): number {
  let depth = 0;
  for (let i = from; i < masked.length; i++) {
    const ch = masked[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') {
      if (depth === 0) return i;
      depth--;
    } else if (ch === ';' && depth === 0) return i;
  }
  return masked.length;
}

const SERVICE_CALL = /\bthis\s*\.\s*([A-Za-z_$][\w$]*)\s*\.\s*([A-Za-z_$][\w$]*)\s*(?:<[^()]*?>)?\s*\(/g;
const LOCAL_RECEIVER = /(^|[^\w$.])([A-Za-z_$][\w$]*)\s*\.\s*(?:pipe|subscribe)\s*\(/g;

interface Candidate {
  type: string;
  method: string;
}

function callsIn(masked: string, from: number, to: number): Candidate[] {
  const calls: Candidate[] = [];
  for (const m of masked.slice(from, to).matchAll(SERVICE_CALL)) calls.push({type: m[1], method: m[2]});
  return calls;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The candidates of the statement around `at`, by field name for now. */
function calledFrom(masked: string, at: number): Candidate[] {
  const start = statementStart(masked, at);
  const calls = callsIn(masked, start, at);
  if (calls.length > 0) return calls;
  // `this.load = owners$.subscribe(`: the request was built where the local was filled.
  const lineEnd = masked.indexOf('\n', at);
  for (const m of masked.slice(start, lineEnd < 0 ? masked.length : lineEnd).matchAll(LOCAL_RECEIVER)) {
    const local = m[2];
    if (local === 'this') continue;
    const assigned = new RegExp(`(?:^|[^\\w$.])${escapeRegExp(local)}\\s*=(?!=)`, 'g');
    let last: number | undefined;
    for (const a of masked.slice(0, start).matchAll(assigned)) last = a.index! + a[0].length;
    if (last !== undefined) return callsIn(masked, last, statementEnd(masked, last));
  }
  return [];
}

/** `ownerService` → `OwnerService`, from its declaration: a constructor parameter, a field, `inject(…)`. */
function typeOfField(masked: string, field: string): string | undefined {
  const name = escapeRegExp(field);
  const typed = new RegExp(`(?:^|[^\\w$.])${name}\\s*[?!]?\\s*:\\s*([A-Z][\\w$]*)`).exec(masked);
  if (typed) return typed[1];
  return new RegExp(`(?:^|[^\\w$.])${name}\\s*=\\s*inject\\s*\\(\\s*([A-Z][\\w$]*)`).exec(masked)?.[1];
}

/** The file a class is imported from, when the import is this app's own (relative). */
function importedFile(source: string, type: string, fromFile: string): string | undefined {
  for (const m of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const names = m[1].split(',').map((n) => n.trim().split(/\s+as\s+/).pop());
    if (!names.includes(type) || !m[2].startsWith('.')) continue;
    const parts = fromFile.split('/').slice(0, -1);
    for (const segment of `${m[2]}.ts`.split('/')) {
      if (segment === '..') parts.pop();
      else if (segment !== '.') parts.push(segment);
    }
    return parts.join('/');
  }
  return undefined;
}

/** The body of `method` as declared in a class's source, or undefined when it is not. */
function bodyOf(source: string, method: string): string | undefined {
  const masked = maskSource(source);
  const declared = new RegExp(
    `^[ \\t]*(?:(?:public|private|protected|async|static|override)\\s+)*${escapeRegExp(method)}`
    + '\\s*(?:<[^()]*?>)?\\s*\\(', 'm').exec(masked);
  if (!declared) return undefined;
  const open = masked.indexOf('{', declared.index + declared[0].length);
  if (open < 0) return undefined;
  let depth = 0;
  for (let i = open; i < masked.length; i++) {
    if (masked[i] === '{') depth++;
    else if (masked[i] === '}' && --depth === 0) return source.slice(open, i + 1);
  }
  return source.slice(open);
}

const VERB_CALL = /\.\s*(get|post|put|delete|patch|head|options)\s*[<(]/gi;

/** How well a method's body explains the request: verb first, then literals the URL carries. */
function fit(body: string, request: SentRequest): {verb: boolean; matched: number; missed: number} {
  const verbs = [...maskSource(body).matchAll(VERB_CALL)].map((m) => m[1].toUpperCase());
  const verb = !request.verb || verbs.length === 0 || verbs.includes(request.verb.toUpperCase());
  let matched = 0;
  let missed = 0;
  for (const m of body.matchAll(/'([^'\\\n]*)'|"([^"\\\n]*)"|`([^`$\\]*)`/g)) {
    const literal = m[1] ?? m[2] ?? m[3] ?? '';
    if (literal.length < 2) continue;
    if (request.url?.includes(literal)) matched++;
    else missed++;
  }
  return {verb, matched, missed};
}

interface Resolved {
  label: string;
  matched: number;
  missed: number;
}

function resolveCandidates(
  candidates: Candidate[], component: string, componentFile: string, frontendRoot: string,
  readSource: ReadSource, request: SentRequest,
): string | undefined {
  const masked = maskSource(component);
  const resolved: Resolved[] = [];
  const seen = new Set<string>();
  for (const {type: field, method} of candidates) {
    const type = typeOfField(masked, field);
    const file = type ? importedFile(component, type, componentFile) : undefined;
    const source = file ? readSource(`${frontendRoot}/${file}`) : undefined;
    const body = source ? bodyOf(source, method) : undefined;
    if (!type || !body) continue;
    const label = `${type}.${method}`;
    if (seen.has(label)) continue;
    seen.add(label);
    const score = fit(body, request);
    if (score.verb) resolved.push({label, matched: score.matched, missed: score.missed});
  }
  if (resolved.length <= 1) return resolved[0]?.label;
  resolved.sort((a, b) => b.matched - a.matched || a.missed - b.missed);
  const [best, second] = resolved;
  return best.matched !== second.matched || best.missed !== second.missed ? best.label : undefined;
}

const NOT_A_METHOD = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'constructor']);
const MEMBER_DECL = /^[ \t]*(?:(?:public|private|protected|async|static|override)\s+)*([A-Za-z_$][\w$]*)\s*\([^;]*$/;

/** `OwnerListComponent.searchByLastName`: the member the line is written in. */
function enclosingMethod(component: string, line: number): string | undefined {
  const lines = maskSource(component).split('\n');
  const cls = /\bclass\s+([A-Za-z_$][\w$]*)/.exec(component)?.[1];
  for (let i = Math.min(line, lines.length) - 1; i >= 0; i--) {
    const m = MEMBER_DECL.exec(lines[i]);
    if (!m || NOT_A_METHOD.has(m[1]) || !/\{\s*$/.test(lines[i])) continue;
    return cls ? `${cls}.${m[1]}` : m[1];
  }
  return undefined;
}

/**
 * The label of the call that one browser request was made through, or undefined when it has no call site.
 * `frontendRoot` is the frontend module's directory; the frames are relative to it.
 */
export function clientMethodOf(
  frames: CallFrame[], request: SentRequest, frontendRoot: string, readSource: ReadSource,
): string | undefined {
  const trigger = triggerOf(frames);
  if (!trigger) return undefined;
  const fallback = `${trigger.file.split('/').pop()}:${trigger.line}`;
  const component = readSource(`${frontendRoot}/${trigger.file}`);
  if (component === undefined) return fallback;
  const lineText = component.split('\n')[trigger.line - 1];
  // A line the checkout no longer has is not the line that ran: no reading into it.
  if (lineText === undefined || (trigger.text !== undefined && lineText.trim() !== trigger.text)) {
    return fallback;
  }
  const masked = maskSource(component);
  const lineStart = offsetOfLine(component, trigger.line);
  const subscribed = masked.slice(lineStart, lineStart + lineText.length).lastIndexOf('subscribe');
  const at = lineStart + (subscribed >= 0 ? subscribed : lineText.length);
  const candidates = calledFrom(masked, at);
  return resolveCandidates(candidates, component, trigger.file, frontendRoot, readSource, request)
    ?? enclosingMethod(component, trigger.line) ?? fallback;
}
