// A self-call arrow says which method ran; this makes it say where that method is.
//
// Nothing new has to be recorded for it. The OpenTelemetry Java agent already stamps
// every INTERNAL span it opens with `code.namespace` and `code.function` — the class and
// the method the span was opened on — whether the span came from @WithSpan or from the
// agent's own instrumentation of a Spring Data repository. Those two attributes have been
// sitting in the span cache all along, so a diagram recorded weeks ago gains the links by
// being re-rendered, with no traced run.
//
// The line is read back from today's source rather than from the trace, for the same
// reason the section headers are (see test-location.ts): a cached run re-rendered later
// then points at where the method is *now*, not at the line it happened to occupy when it
// ran. And, as there, a method that cannot be found is a link to the file rather than a
// missing link — with 0 the handle simply carries no line.

/** What every method link says on hover, naming what it opens. */
export function methodLinkTooltip(namespace: string, fn: string): string {
  return `{Click to open ${simpleNameOf(namespace)}.${fn}}`;
}

/**
 * The marker beside a linked label. `⊕` already means "this arrow hides a payload you can
 * unfold in place"; a link that leaves the page for an editor is a different promise and
 * gets a different glyph.
 */
export const METHOD_LINK_MARKER = '↗';

/** Reads a file, or undefined when it is not there — the generator's own `readFile`. */
export type ReadSource = (absolutePath: string) => string | undefined;

/** `victor.training.petclinic.rest.OwnerRestController` → `OwnerRestController`. */
function simpleNameOf(namespace: string): string {
  return namespace.slice(namespace.lastIndexOf('.') + 1);
}

/**
 * Where a span's class lives, relative to the repo root.
 *
 * The module directory is the span's own `serviceName`: the backend boots with
 * `OTEL_SERVICE_NAME=petclinic-backend` and its sources sit in `petclinic-backend/`, and
 * the same holds for every other service in this repo. Where that stops being true the
 * path simply fails to read back and the arrow keeps the label it always had — which is
 * why this guesses rather than being told, and why the caller checks before linking.
 *
 * A nested class reports `Outer$Inner`; the file is named after the outer one.
 */
export function sourcePathOf(serviceName: string, namespace: string): string | undefined {
  if (!serviceName || !namespace) return undefined;
  const topLevel = namespace.split('$')[0];
  return `${serviceName}/src/main/java/${topLevel.split('.').join('/')}.java`;
}

/**
 * Jars linked into every service. A span opened inside one carries the service that loaded
 * it, so its class is looked for there first and then here.
 */
const LIBRARY_MODULES = ['petclinic-commons'];

/** A call, not a declaration: `x.foo(`, `y = foo(`, `return foo(`, `foo(bar(`. */
const CALLED_NOT_DECLARED = /[.=(,]\s*$/;

/**
 * Which of a method's overloads ran, as the span knows it.
 *
 * `types` is the real answer: the simple names of the declared parameter types, which
 * petclinic-commons' boundary aspect stamps as `boundary.parameters` (`String, HomeCountry`).
 * `arity` is the next best, counted from the arguments the same aspect printed — a span
 * recorded before the types were stamped still tells `normalize(phone)` from
 * `normalize(phone, country)` by how many values went in.
 */
export interface Overload {
  types?: string[];
  arity?: number;
}

/**
 * The 1-based line `fn` is declared on, or 0 when the source never declares it.
 *
 * 0 is the ordinary answer for a method this repo inherits rather than writes — one a
 * Spring Data base interface declares, say — and the honest one: the class is still
 * where the reader wants to land, and the line would be a guess.
 *
 * The scan is deliberately as small as the one in test-location.ts. A declaration is a
 * line that mentions the name in a position a declaration can occupy, which rules out the
 * shapes that actually occur above a declaration in this codebase: the method being
 * called on a receiver, called to fill a variable or a return, or named in a comment
 * (`{@link #normalize(String)}`). It is not a Java parser and does not try to be one.
 *
 * With overloads, the name alone lands on the first of them — `PhoneNumbers.normalize`
 * once opened the 1-arg method for an arrow that had called the 2-arg one. So when the
 * span says which overload ran, the declaration whose parameters match it wins; failing
 * that, the first one by name.
 */
export function lineOfMethod(source: string, fn: string, overload: Overload = {}): number {
  const mention = new RegExp(`(^|[^\\w$.])${escapeRegExp(fn)}\\s*\\(`);
  const lines = source.split(/\r?\n/);
  const declared: {line: number; types: string[]}[] = [];
  for (let i = 0; i < lines.length; i++) {
    const at = lines[i].search(mention);
    if (at < 0) continue;
    const before = lines[i].slice(0, at + (lines[i][at] === fn[0] ? 0 : 1));
    if (CALLED_NOT_DECLARED.test(before)) continue;
    if (/^\s*(?:return|throw)\b/.test(lines[i])) continue;
    if (/^\s*(?:\/\/|\/\*|\*)/.test(lines[i])) continue;
    declared.push({line: i + 1, types: parameterTypesFrom(lines, i, lines[i].indexOf('(', at))});
  }
  const {types, arity} = overload;
  const exact = types && declared.find((d) => sameTypes(d.types, types));
  const counted = arity !== undefined ? declared.find((d) => d.types.length === arity) : undefined;
  return (exact || counted || declared[0])?.line ?? 0;
}

/**
 * The parameter types of the declaration whose `(` is at `lines[row][column]`, as simple
 * names: `(@RequestBody final Map<String, Integer> m, String... rest)` → `Map`, `String[]`.
 * Erased and unqualified, which is what `Class.getSimpleName()` gives on the other side.
 */
export function parameterTypesFrom(lines: string[], row: number, column: number): string[] {
  let text = '';
  let depth = 0;
  for (let i = row; i < lines.length; i++) {
    for (let j = i === row ? column : 0; j < lines[i].length; j++) {
      const ch = lines[i][j];
      if (ch === '(') depth++;
      else if (ch === ')' && --depth === 0) return splitParameters(text.slice(1));
      text += ch;
    }
    text += ' ';
  }
  return [];
}

function splitParameters(list: string): string[] {
  const cleaned = list.replace(/@[\w.]+(\s*\([^)]*\))?/g, ' ');
  const params: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of cleaned) {
    if (ch === '<') depth++;
    if (ch === '>') depth--;
    if (ch === ',' && depth === 0) {
      params.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  params.push(current);
  return params.map(simpleTypeOf).filter((t) => t !== '');
}

/** `final java.util.Map<K, V> byId` → `Map`; `String... rest` → `String[]`. */
function simpleTypeOf(parameter: string): string {
  let generic = parameter;
  while (/<[^<>]*>/.test(generic)) generic = generic.replace(/<[^<>]*>/g, '');
  const words = generic.replace(/\bfinal\b/g, ' ').replace(/\.\.\./g, '[] ')
    .replace(/\s*\[\s*\]/g, '[]').trim().split(/\s+/);
  if (words.length < 2) return '';
  const type = words.slice(0, -1).join('');
  return type.slice(type.lastIndexOf('.') + 1);
}

function sameTypes(declared: string[], ran: string[]): boolean {
  return declared.length === ran.length && declared.every((t, i) => t === ran[i]);
}

/**
 * The overload a span names: its stamped parameter types when it has them, else the
 * number of arguments it printed. `[8474461990, a.B@64fb61b]` is two; brackets nest, so a
 * record's `Owner[id=1, name=x]` is one.
 */
export function overloadOf(attributes: Record<string, string>): Overload {
  const stamped = attributes[PARAMETERS_ATTRIBUTE];
  if (stamped !== undefined) {
    return {types: stamped.split(',').map((t) => t.trim()).filter((t) => t !== '')};
  }
  const printed = attributes['boundary.args'];
  if (printed === undefined || !/^\[.*\]$/s.test(printed)) return {};
  const inner = printed.slice(1, -1);
  if (inner.trim() === '') return {arity: 0};
  let depth = 0;
  let arity = 1;
  for (const ch of inner) {
    if (ch === '[' || ch === '(' || ch === '{') depth++;
    else if (ch === ']' || ch === ')' || ch === '}') depth--;
    else if (ch === ',' && depth === 0) arity++;
  }
  return {arity};
}

/** Stamped by petclinic-commons' ModuleBoundaryTracing: `String, HomeCountry`. */
export const PARAMETERS_ATTRIBUTE = 'boundary.parameters';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The clickable handle for the method a span was opened on — `src://<repo-relative
 * path>[:line]` with the hover text appended, the shape `[[…]]` wants — or undefined when
 * there is nothing to point at.
 *
 * Undefined covers every way this can come up empty — a span the agent left no code
 * attributes on, a service whose sources are not laid out under its own name, a class
 * this checkout does not have — and each of them ends the same way: the label stays as it
 * was. A handle is only emitted for a file that was read.
 */
export function methodHandle(
  attributes: Record<string, string>,
  serviceName: string,
  repoRoot: string,
  readSource: ReadSource,
): string | undefined {
  const namespace = attributes['code.namespace'];
  const fn = attributes['code.function'];
  if (!namespace || !fn) return undefined;
  for (const module of [serviceName, ...LIBRARY_MODULES]) {
    const relative = sourcePathOf(module, namespace);
    const text = relative ? readSource(`${repoRoot}/${relative}`) : undefined;
    if (text === undefined) continue;
    const line = lineOfMethod(text, fn, overloadOf(attributes));
    return `src://${relative}${line > 0 ? `:${line}` : ''}${methodLinkTooltip(namespace, fn)}`;
  }
  return undefined;
}

/**
 * `label`, as the clickable face of the method it names.
 *
 * The marker goes inside the link, so the whole thing — name and glyph — is one target:
 * a reader aiming at a 6-pixel arrow on a diagram they have zoomed out of would miss it
 * more often than not.
 */
export function linkedMethodLabel(label: string, handle: string | undefined): string {
  return handle ? `[[${handle} ${label} ${METHOD_LINK_MARKER}]]` : label;
}
