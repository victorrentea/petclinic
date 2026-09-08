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

/** A call, not a declaration: `x.foo(`, `y = foo(`, `return foo(`, `foo(bar(`. */
const CALLED_NOT_DECLARED = /[.=(,]\s*$/;

/**
 * The 1-based line `fn` is declared on, or 0 when the source never declares it.
 *
 * 0 is the ordinary answer for a method this repo inherits rather than writes — one a
 * Spring Data base interface declares, say — and the honest one: the class is still
 * where the reader wants to land, and the line would be a guess.
 *
 * The scan is deliberately as small as the one in test-location.ts. It takes the first
 * line that mentions the name in a position a declaration can occupy, which rules out the
 * two shapes that actually occur above a declaration in this codebase: the method being
 * called on a receiver, and the method being called to fill a variable or a return. It is
 * not a Java parser and does not try to be one; a wrong line inside the right file is a
 * cheap mistake, and no line at all is the fallback.
 */
export function lineOfMethod(source: string, fn: string): number {
  const mention = new RegExp(`(^|[^\\w$.])${escapeRegExp(fn)}\\s*\\(`);
  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const at = lines[i].search(mention);
    if (at < 0) continue;
    const before = lines[i].slice(0, at + (lines[i][at] === fn[0] ? 0 : 1));
    if (CALLED_NOT_DECLARED.test(before)) continue;
    if (/^\s*(?:return|throw)\b/.test(lines[i])) continue;
    return i + 1;
  }
  return 0;
}

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
  const relative = sourcePathOf(serviceName, namespace);
  if (!relative) return undefined;
  const text = readSource(`${repoRoot}/${relative}`);
  if (text === undefined) return undefined;
  const line = lineOfMethod(text, fn);
  return `src://${relative}${line > 0 ? `:${line}` : ''}${methodLinkTooltip(namespace, fn)}`;
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
