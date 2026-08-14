import {applyParameters, formatSqlLabel} from './sql-label';
import {jsonNote} from './json-label';
import {DEFAULT_DIAGRAM_OPTIONS, DiagramOptions, describeOptions} from './options';

export interface NormSpan {
  traceId: string;
  spanId: string;
  parentSpanId: string;
  name: string;
  kind: string;
  serviceName: string;
  startNano: number;
  attributes: Record<string, string>;
}

const KIND_BY_NUMBER: Record<number, string> = {
  0: 'UNSPECIFIED', 1: 'INTERNAL', 2: 'SERVER', 3: 'CLIENT', 4: 'PRODUCER', 5: 'CONSUMER',
};

function normKind(kind: unknown): string {
  if (typeof kind === 'number') return KIND_BY_NUMBER[kind] ?? 'UNSPECIFIED';
  if (typeof kind === 'string') return kind.replace('SPAN_KIND_', '') || 'UNSPECIFIED';
  return 'UNSPECIFIED';
}

function attrValue(v: any): string {
  if (v == null) return '';
  return String(
    v.stringValue ?? v.intValue ?? v.boolValue ?? v.doubleValue ?? '',
  );
}

function attrsToMap(attrs: any[] = []): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of attrs) out[a.key] = attrValue(a.value);
  return out;
}

export function parseTempoTrace(tempoJson: any): NormSpan[] {
  const spans: NormSpan[] = [];
  for (const batch of tempoJson?.batches ?? []) {
    const resourceAttrs = attrsToMap(batch?.resource?.attributes);
    const serviceName = resourceAttrs['service.name'] ?? 'unknown';
    const scopes = batch?.scopeSpans ?? batch?.instrumentationLibrarySpans ?? [];
    for (const scope of scopes) {
      for (const s of scope?.spans ?? []) {
        spans.push({
          traceId: s.traceId ?? '',
          spanId: s.spanId ?? '',
          parentSpanId: s.parentSpanId ?? '',
          name: s.name ?? '',
          kind: normKind(s.kind),
          serviceName,
          startNano: Number(s.startTimeUnixNano ?? 0),
          attributes: attrsToMap(s.attributes),
        });
      }
    }
  }
  return spans;
}

const DB_NAME_RE = /^(SELECT|INSERT|UPDATE|DELETE|MERGE)\b/i;

function participantOf(span: NormSpan): string {
  if (span.serviceName === 'petclinic-frontend') return 'Browser';
  // both the old and the stable database semconv, since the agent can emit either
  const isDb = ['db.system', 'db.system.name', 'db.statement', 'db.query.text']
    .some((key) => key in span.attributes) || DB_NAME_RE.test(span.name);
  if (span.kind === 'CLIENT' && isDb) return 'DB';
  if (span.serviceName === 'petclinic-backend') return 'Backend';
  return span.serviceName || 'unknown';
}

// `db.statement` is the OTel agent's SQL; `db.query.text` is the same thing
// under the stable database semconv, emitted once the agent opts in.
function sqlOf(span: NormSpan): string | undefined {
  const sql = span.attributes['db.statement'] ?? span.attributes['db.query.text'];
  return sql?.trim() || undefined;
}

const PARAMETER_KEY_RE = /^db\.query\.parameter\.(\d+)$/;

/** The bound values, in placeholder order — captured only when the agent is asked to. */
function parametersOf(span: NormSpan): string[] {
  return Object.entries(span.attributes)
    .map(([key, value]) => ({index: PARAMETER_KEY_RE.exec(key)?.[1], value}))
    .filter((p): p is {index: string; value: string} => p.index !== undefined)
    .sort((a, b) => Number(a.index) - Number(b.index))
    .map((p) => p.value);
}

/** What the arrow into this span says: the SQL for a DB hop, the span name otherwise. */
function arrowLabel(span: NormSpan, target: string, options: DiagramOptions): string {
  if (target !== 'DB' || options.sql === 'off') return span.name;
  const sql = sqlOf(span);
  if (!sql) return span.name;
  return formatSqlLabel(options.sql === 'values' ? applyParameters(sql, parametersOf(span)) : sql);
}

// The browser is where the payloads are captured, so they sit on the frontend
// CLIENT span — one level up from the backend SERVER span the arrow is drawn from.
function bodyOf(span: NormSpan, parent: NormSpan | undefined, key: string): string | undefined {
  return span.attributes[key] ?? parent?.attributes[key];
}

// Only a meaningful label (e.g. an HTTP status) is worth a return arrow;
// a bare "return" carries no information, so callers skip the line when undefined.
function returnLabel(span: NormSpan): string | undefined {
  return span.attributes['http.status_code']
    ?? span.attributes['http.response.status_code'];
}

const PARTICIPANT_ORDER = ['Browser', 'Backend', 'DB'];

function orderedParticipants(present: Set<string>): string[] {
  const ranked = PARTICIPANT_ORDER.filter((p) => present.has(p));
  const rest = [...present].filter((p) => !PARTICIPANT_ORDER.includes(p)).sort();
  return [...ranked, ...rest];
}

function emitTrace(
  spans: NormSpan[], lines: string[], present: Set<string>, options: DiagramOptions,
): void {
  const byId = new Map(spans.map((s) => [s.spanId, s]));
  const childrenOf = (id: string) => spans
    .filter((s) => s.parentSpanId === id)
    .sort((a, b) => a.startNano - b.startNano);

  const walk = (span: NormSpan, out: string[]): void => {
    const p = participantOf(span);
    const parent = span.parentSpanId ? byId.get(span.parentSpanId) : undefined;
    const pp = parent ? participantOf(parent) : undefined;
    const crossing = pp !== undefined && pp !== p;
    const selfCustom = pp === p && span.kind === 'INTERNAL';

    // Draw the subtree first: an activation bar is only worth its vertical space
    // when something is drawn *inside* it. A call that reaches nobody — a leaf DB
    // query, a self-span with no children — gets a bare arrow instead.
    const inner: string[] = [];
    for (const child of childrenOf(span.spanId)) walk(child, inner);

    if (!crossing && !selfCustom) {
      out.push(...inner);
      return;
    }

    const bodies = options.httpBodies && crossing ? `${pp}, ${p}` : undefined;

    if (crossing) {
      present.add(pp!);
      present.add(p);
      out.push(`${pp} -> ${p}: ${arrowLabel(span, p, options)}`);
      if (bodies) out.push(...jsonNote(bodies, bodyOf(span, parent, 'http.request.body')));
    } else {
      // a self-span (e.g. @WithSpan) whose children — DB calls, downstream
      // requests — render inside its own lifetime
      present.add(p);
      out.push(`${p} -> ${p}: ${span.name}`);
    }

    if (inner.length > 0) out.push(`activate ${p}`);
    out.push(...inner);
    // Only a meaningful return (an HTTP status) earns an arrow back.
    const label = crossing ? returnLabel(span) : undefined;
    if (label) out.push(`${p} --> ${pp}: ${label}`);
    if (bodies) out.push(...jsonNote(bodies, bodyOf(span, parent, 'http.response.body')));
    if (inner.length > 0) out.push(`deactivate ${p}`);
  };

  const roots = spans
    .filter((s) => !s.parentSpanId || !byId.has(s.parentSpanId))
    .sort((a, b) => a.startNano - b.startNano);
  for (const root of roots) walk(root, lines);
}

/** One tagged test, with every trace its interactions produced. */
export interface DiagramScenario {
  title: string;
  traces: NormSpan[][];
}

export function renderPuml(
  title: string,
  scenarios: DiagramScenario[],
  options: DiagramOptions = DEFAULT_DIAGRAM_OPTIONS,
): string {
  // A trace can carry spans yet draw nothing — a lone browser `click`, say. Render
  // each in isolation and keep only what has content, so an empty trace cannot
  // pad a section, and a scenario left with nothing cannot leave a bare header.
  const present = new Set<string>();
  const sections: DiagramSection[] = [];
  for (const scenario of scenarios) {
    const lines: string[] = [];
    for (const spans of scenario.traces) {
      const traceLines: string[] = [];
      const drawn = new Set<string>();
      emitTrace(spans, traceLines, drawn, options);
      if (traceLines.length === 0) continue;
      drawn.forEach((p) => present.add(p));
      lines.push(...traceLines);
    }
    if (lines.length === 0) continue;
    sections.push({title: scenario.title, lines});
  }

  const header = [
    '@startuml',
    // ' starts a PlantUML comment: this warning is for whoever opens the file,
    // it never reaches the rendered diagram.
    `' ⚠️  GENERATED FILE — DO NOT EDIT. Every edit is lost on the next run.`,
    `' Drawn from real Tempo traces of ${title}, for the scenarios tagged`,
    `' @generate_sequence. Change the test, not this file, then regenerate with`,
    `' petclinic-test/run-tests-with-tracing.sh`,
    `'`,
    `' Detail shown here: ${describeOptions(options)}`,
    `' Want more or less? The traces already carry all of it — re-rendering replays`,
    `' them from Tempo (~1s): no test run, no backend, no browser, only Grafana up:`,
    `'     cd petclinic-test`,
    `'     npm run diagram:lean    # call flow only`,
    `'     npm run diagram         # + the SQL statements`,
    `'     npm run diagram:full    # + bound parameter values + JSON payloads`,
    `'     SEQ_SQL=off|statement|values SEQ_HTTP_BODIES=0|1 npm run trace:diagram`,
    'hide footbox',
    `title ${title}`,
    // footer (bottom of every page) states the diagram's provenance
    'footer @generate_sequence — generated from real traces, do not edit',
    ...orderedParticipants(present).map((p) => `participant ${p}`),
  ];
  const body = sections.flatMap((s) => [`== ${s.title} ==`, ...s.lines]);
  return [...header, ...body, '@enduml', ''].join('\n');
}

interface DiagramSection {
  title: string;
  lines: string[];
}

export function spansToPuml(
  spans: NormSpan[], title: string, options?: DiagramOptions,
): string {
  return renderPuml(title, [{title, traces: [spans]}], options);
}
