import type {NormSpan} from './trace-to-puml';
import type {ReadSource} from './code-location';
import {LIBRARY_MODULES, methodLinkTooltip} from './code-location';

/**
 * The method a request lands on, for the arrow that carries it.
 *
 * A SERVER span knows its route (`GET /api/owners/{ownerId}`) and nothing about the code
 * that answered it: the agent opens no span for a controller method. So the route is
 * resolved against the service's own sources, the way Spring resolves it — the class-level
 * `@RequestMapping` joined to the method's `@GetMapping` — and the arrow's words open the
 * first class of the application the request reaches (Victor, 10 Nov 2026).
 *
 * A line scan, not a Java parser: the three things it needs — a class's base path, a
 * method's mapping annotation, and the declaration under it — are each one line of Java,
 * and a mapping annotation appears nowhere else. The same scan the review page runs for its
 * detail panel's head (human-review's `spring_handlers`), so the two never disagree.
 */

/** Lists every file under a directory, recursively, as absolute paths. */
export type WalkFiles = (dir: string) => string[];

export interface Handler {
  /** Repo-relative: `petclinic-backend/src/main/java/…/OwnerRestController.java`. */
  file: string;
  line: number;
  /** `OwnerRestController.getOwner`. */
  name: string;
}

const HTTP_VERBS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const MAPPING = /^@(Get|Post|Put|Delete|Patch|Request)Mapping\b/;
const REQUEST_METHOD = /RequestMethod\.(GET|POST|PUT|DELETE|PATCH)\b/g;
const NAMED_PATH = /\b(?:value|path)\s*=\s*\{?\s*"([^"]*)"/;
const POSITIONAL_PATH = /^\s*\{?\s*"([^"]*)"/;
const NAMED_CONSTANT = /\b(?:value|path)\s*=\s*\{?\s*([A-Za-z_][\w.]*)/;
const POSITIONAL_CONSTANT = /^\s*\{?\s*([A-Za-z_][\w.]*)\s*(?:[,}]|$)/;
const TYPE_DECL = /\b(?:class|interface|record)\s+([A-Za-z_]\w*)/;
const METHOD_NAME = /([A-Za-z_]\w*)\s*\(/;
const STRING_CONSTANT = /static\s+final\s+String\s+([A-Za-z_]\w*)\s*=\s*"([^"]*)"/g;

/** The parenthesised text of the annotation that starts on `lines[row]`, and its last row. */
function annotationArgs(lines: string[], row: number): {args: string; end: number} {
  let text = '';
  let depth = 0;
  let started = false;
  for (let j = row; j < lines.length; j++) {
    for (const ch of lines[j]) {
      if (ch === '(') {
        depth++;
        started = true;
        if (depth === 1) continue;
      } else if (ch === ')' && --depth === 0) {
        return {args: text, end: j};
      }
      if (started) text += ch;
    }
    // A bare `@GetMapping` ends on its own line; one whose `(` wraps goes on.
    if (!started) return {args: '', end: j};
    text += ' ';
  }
  return {args: text, end: lines.length - 1};
}

function mappingPath(args: string, constants: Map<string, string>): string {
  const literal = NAMED_PATH.exec(args) ?? POSITIONAL_PATH.exec(args);
  if (literal) return literal[1];
  // `@PostMapping(VisitBookedNotification.PATH)`: a route the service and its client share.
  const ref = NAMED_CONSTANT.exec(args) ?? POSITIONAL_CONSTANT.exec(args);
  if (!ref) return '';
  return constants.get(ref[1]) ?? constants.get(ref[1].split('.').pop()!) ?? '';
}

/** `{ownerId:\d+}` is `{ownerId}` on the span: Spring reports the template, not the regex. */
function normalizeRoute(route: string): string {
  const parts = route.replace(/\{([^}:]+):[^}]*\}/g, '{$1}').split('/').filter((p) => p !== '');
  return `/${parts.join('/')}`;
}

/** Every `VERB /route` one controller source handles, into `found`. */
export function controllerRoutes(
  source: string, file: string, constants: Map<string, string>, found: Map<string, Handler>,
): void {
  const lines = source.split(/\r?\n/);
  let base = '';
  let cls = file.split('/').pop()!.replace(/\.java$/, '');
  let pending: {verbs: string[]; path: string} | undefined;
  for (let i = 0; i < lines.length; i++) {
    const stripped = lines[i].trim();
    if (!stripped || /^(?:\/\/|\/\*|\*)/.test(stripped)) continue;
    if (stripped.startsWith('@')) {
      const {args, end} = annotationArgs(lines, i);
      const mapping = MAPPING.exec(stripped);
      if (mapping) {
        const verbs = mapping[1] !== 'Request' ? [mapping[1].toUpperCase()]
          : [...args.matchAll(REQUEST_METHOD)].map((m) => m[1]);
        pending = {verbs: verbs.length > 0 ? verbs : HTTP_VERBS, path: mappingPath(args, constants)};
      }
      // Annotations pile up until a declaration consumes them: `@Operation`, `@PreAuthorize`
      // and a four-line `@ApiResponse` between a mapping and its method cost nothing.
      i = end;
      continue;
    }
    const declared = TYPE_DECL.exec(stripped);
    if (declared) {
      cls = declared[1];
      base = pending?.path ?? '';
      pending = undefined;
      continue;
    }
    const name = pending ? METHOD_NAME.exec(stripped) : null;
    if (name && pending) record(found, pending, base, file, i + 1, `${cls}.${name[1]}`);
    pending = undefined;
  }
}

function record(
  found: Map<string, Handler>, pending: {verbs: string[]; path: string}, base: string,
  file: string, line: number, name: string,
): void {
  for (const verb of pending.verbs) {
    const key = `${verb} ${normalizeRoute(`${base}/${pending.path}`)}`;
    if (!found.has(key)) found.set(key, {file, line, name});
  }
}

/** `VERB /route` → the method that handles it, for every controller of one module. */
export function moduleHandlers(
  module: string, repoRoot: string, readSource: ReadSource, walk: WalkFiles,
): Map<string, Handler> {
  const constants = new Map<string, string>();
  const controllers: Array<{file: string; text: string}> = [];
  // The jars linked into every service are read for their constants too: a route a service
  // and its client share (`VisitBookedNotification.PATH`) is declared in petclinic-commons.
  const sources = [module, ...LIBRARY_MODULES.filter((m) => m !== module)].flatMap((m) =>
    walk(`${repoRoot}/${m}/src/main/java`).filter((f) => f.endsWith('.java')).sort()
      .map((absolute) => ({absolute, own: m === module})));
  for (const {absolute, own} of sources) {
    const text = readSource(absolute);
    if (text === undefined) continue;
    const file = absolute.slice(repoRoot.length + 1);
    if (text.includes('static final String')) {
      const cls = file.split('/').pop()!.replace(/\.java$/, '');
      for (const m of text.matchAll(STRING_CONSTANT)) {
        constants.set(`${cls}.${m[1]}`, m[2]);
        if (!constants.has(m[1])) constants.set(m[1], m[2]);
      }
    }
    if (own && /@(?:Rest)?Controller\b/.test(text)) controllers.push({file, text});
  }
  // Second, so a mapping may name a constant declared in a file the walk reached later.
  const found = new Map<string, Handler>();
  for (const {file, text} of controllers) controllerRoutes(text, file, constants, found);
  return found;
}

/** `GET /api/owners/{ownerId}`, from the span's own attributes before its name. */
export function routeOf(span: NormSpan): string | undefined {
  const named = /^([A-Z]+)\s+(\/\S*)$/.exec(span.name.trim());
  const verb = span.attributes['http.request.method'] ?? span.attributes['http.method'] ?? named?.[1];
  const route = span.attributes['http.route'] ?? named?.[2];
  return verb && route ? `${verb.toUpperCase()} ${normalizeRoute(route)}` : undefined;
}

/** The method a SERVER span's request landed on — its name and its `src://` handle — or undefined. */
export function handlerOf(
  span: NormSpan, handlers: Map<string, Handler>,
): {name: string; handle: string} | undefined {
  const route = span.kind === 'SERVER' ? routeOf(span) : undefined;
  const hit = route ? handlers.get(route) : undefined;
  if (!hit) return undefined;
  const [cls, fn] = [hit.name.slice(0, hit.name.lastIndexOf('.')), hit.name.split('.').pop()!];
  return {name: hit.name, handle: `src://${hit.file}:${hit.line}${methodLinkTooltip(cls, fn)}`};
}

/** The `src://` handle on the method a SERVER span's request landed on, or undefined. */
export function handlerHandle(span: NormSpan, handlers: Map<string, Handler>): string | undefined {
  return handlerOf(span, handlers)?.handle;
}
