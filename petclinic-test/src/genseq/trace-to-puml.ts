import {formatOriginLabel, formatSqlDetail, formatSqlLabel, splitOrigin} from './sql-label';
import {formatJsonDetail, jsonNote} from './json-label';
import {DEFAULT_DIAGRAM_OPTIONS, DiagramOptions, describeOptions, revealable} from './options';
import {DetailCollector, DetailIndex, DetailStep} from './detail-index';
import {OperationNames, defaultOperations, operationNameOf} from './openapi-operations';

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

/**
 * What the arrow into this span says. For a DB hop that is Hibernate's own account of
 * the statement — the HQL, or the entity role it was lazily loading — because that is
 * the grain a reviewer reads a sequence diagram at: *which* call went to the database,
 * not which columns came back. The SQL stays one click away.
 *
 * The span name is the fallback, and it is a poor one: `SELECT petclinic` is what every
 * query in an N+1 is called. It only appears when the origin comment is missing, i.e.
 * the trace was recorded without `hibernate.use_sql_comments`.
 */
function arrowLabel(
  span: NormSpan, target: string, options: DiagramOptions, operations: OperationNames,
): string {
  if (target !== 'DB') {
    // A REST hop's span name is its route; the contract's name for that operation is
    // the line above it, so the arrow says what the call was for before where it went.
    const operation = operationNameOf(span.name, operations);
    return operation ? `${operation}\\n${span.name}` : span.name;
  }
  if (options.sql === 'off') return span.name;
  const sql = sqlOf(span);
  if (!sql) return span.name;
  const {origin} = splitOrigin(sql);
  if (options.interactive) return origin ? formatOriginLabel(origin) : span.name;
  // A baked-in diagram is asked for precisely to have the statement on the page, so it
  // gets both grains: Hibernate's account, then the SQL it compiled to.
  // The values go in *after* the statement is folded into clauses — a bound value
  // reading "Follow up on the vaccination" would otherwise be folded at its own ON.
  const statement = formatSqlLabel(sql, options.sql === 'values' ? parametersOf(span) : []);
  return origin ? `${formatOriginLabel(origin)}\\n${statement}` : statement;
}

// The handle a reader clicks. PlantUML turns `[[scheme://id{tooltip} text]]` into an
// <a href> around its own <text> run in the SVG, which is a stable, generation-time
// anchor for the id — nothing downstream has to match rendered label text.
//
// The link wraps the whole label rather than trailing a ⊕ after it: a glyph is a
// second, smaller thing to aim at, and a reviewer who has understood that arrows are
// clickable wants to click the arrow. The label text is the affordance.
const MARKER_SCHEME = 'genseq://';

/** `label`, wrapped in the link that reveals `steps` — or bare, when there is nothing to reveal. */
function linkLabel(
  label: string, collector: DetailCollector, title: string, steps: DetailStep[], tooltip: string,
): string {
  if (steps.length === 0) return label;
  return `[[${MARKER_SCHEME}${collector.add({title, steps})}{${tooltip}} ${label}]]`;
}

const SQL_TOOLTIP = 'Click for the statement behind this call';
const BODY_TOOLTIP = 'Click for this call’s JSON body';

/**
 * One step: the statement as Hibernate sent it. The bound values ride along as the
 * step's alternate, which the panel offers as a toggle rather than as a second click —
 * a click that swaps the text under you reads as a bug until you have seen it twice,
 * and a `1 / 2` counter is not a discoverable way to say "there is more".
 */
function sqlSteps(span: NormSpan, options: DiagramOptions): DetailStep[] {
  if (!options.interactive || options.sql === 'off') return [];
  const sql = sqlOf(span);
  if (!sql) return [];
  const parameters = parametersOf(span);
  return [{
    label: 'statement as sent — ? for each bound value',
    text: formatSqlDetail(sql),
    ...(parameters.length > 0 ? {
      alternate: {label: 'with the bound values put back', text: formatSqlDetail(sql, parameters)},
    } : {}),
  }];
}

/** hidden → the payload of this one call. */
function bodySteps(
  body: string | undefined, label: string, options: DiagramOptions,
): DetailStep[] {
  if (!options.interactive || !options.httpBodies) return [];
  const text = formatJsonDetail(body);
  if (!text) return [];
  return [{label, text}];
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

// The OTel Hibernate instrumentation draws a span for the session call behind every
// query — `Session.find victor.training.petclinic.domain.Owner`, `Hibernate Query`.
// Under a Spring Data repository that is the repository method restated in Hibernate's
// vocabulary: `OwnerRepository.findById` already said it, and the arrow underneath adds
// a lifeline hop and a nesting level to say it again.
//
// They are kept when nothing above them is a repository — that is the case they do
// carry information for: code using the EntityManager directly, where the session call
// is the only account of what was asked for.
const HIBERNATE_SPAN_RE = /^(Session\.\w+|Hibernate Query)\b/;
const REPOSITORY_SPAN_RE = /Repository\.\w+$/;

const PARTICIPANT_ORDER = ['Browser', 'Backend', 'DB'];

function orderedParticipants(present: Set<string>): string[] {
  const ranked = PARTICIPANT_ORDER.filter((p) => present.has(p));
  const rest = [...present].filter((p) => !PARTICIPANT_ORDER.includes(p)).sort();
  return [...ranked, ...rest];
}

function emitTrace(
  spans: NormSpan[], lines: string[], present: Set<string>, options: DiagramOptions,
  collector: DetailCollector, operations: OperationNames,
): void {
  const byId = new Map(spans.map((s) => [s.spanId, s]));
  // Indexed once: filtering the whole span array per span made an N+1-heavy trace
  // (hundreds of spans, which is exactly what these diagrams are for) quadratic.
  const childrenByParent = new Map<string, NormSpan[]>();
  for (const span of spans) {
    const siblings = childrenByParent.get(span.parentSpanId) ?? [];
    siblings.push(span);
    childrenByParent.set(span.parentSpanId, siblings);
  }
  for (const siblings of childrenByParent.values()) {
    siblings.sort((a, b) => a.startNano - b.startNano);
  }
  const childrenOf = (id: string) => childrenByParent.get(id) ?? [];

  const underRepository = (span: NormSpan): boolean => {
    for (let up = span.parentSpanId ? byId.get(span.parentSpanId) : undefined;
      up; up = up.parentSpanId ? byId.get(up.parentSpanId) : undefined) {
      if (REPOSITORY_SPAN_RE.test(up.name)) return true;
    }
    return false;
  };

  const walk = (span: NormSpan, out: string[], parentParticipant?: string): void => {
    // Whatever the driver does inside a query is the database's business: drawing a
    // child of a DB span would put an arrow *out* of the DB lifeline, as if the
    // database were calling the backend back.
    if (parentParticipant === 'DB') return;

    const p = participantOf(span);
    const parent = span.parentSpanId ? byId.get(span.parentSpanId) : undefined;
    const pp = parent ? participantOf(parent) : undefined;
    const crossing = pp !== undefined && pp !== p;
    const selfCustom = pp === p && span.kind === 'INTERNAL'
      && !(HIBERNATE_SPAN_RE.test(span.name) && underRepository(span));

    // Draw the subtree first: an activation bar is only worth its vertical space
    // when something is drawn *inside* it. A call that reaches nobody — a leaf DB
    // query, a self-span with no children — gets a bare arrow instead.
    const inner: string[] = [];
    for (const child of childrenOf(span.spanId)) walk(child, inner, p);

    if (!crossing && !selfCustom) {
      out.push(...inner);
      return;
    }

    // The baked-in notes and the click-to-reveal markers are the same fact drawn two
    // ways, so a diagram carries one or the other, never both.
    const bodies = options.httpBodies && !options.interactive && crossing ? `${pp}, ${p}` : undefined;

    if (crossing) {
      present.add(pp!);
      present.add(p);
      const steps = p === 'DB'
        ? sqlSteps(span, options)
        : bodySteps(bodyOf(span, parent, 'http.request.body'), 'request body', options);
      const title = p === 'DB' ? span.name : `${pp} → ${p}: ${span.name}`;
      const tooltip = p === 'DB' ? SQL_TOOLTIP : BODY_TOOLTIP;
      const label = linkLabel(arrowLabel(span, p, options, operations), collector, title, steps, tooltip);
      out.push(`${pp} -> ${p}: ${label}`);
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
    if (label) {
      const steps = bodySteps(bodyOf(span, parent, 'http.response.body'), 'response body', options);
      out.push(`${p} --> ${pp}: ${
        linkLabel(label, collector, `${p} → ${pp}: ${label}`, steps, BODY_TOOLTIP)}`);
    }
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

/** The picture and, when it is interactive, what each of its markers reveals. */
export interface RenderedDiagram {
  puml: string;
  details: DetailIndex;
}

export function renderDiagram(
  title: string,
  scenarios: DiagramScenario[],
  options: DiagramOptions = DEFAULT_DIAGRAM_OPTIONS,
  operations: OperationNames = defaultOperations(),
): RenderedDiagram {
  // A trace can carry spans yet draw nothing — a lone browser `click`, say. Render
  // each in isolation and keep only what has content, so an empty trace cannot
  // pad a section, and a scenario left with nothing cannot leave a bare header.
  const present = new Set<string>();
  const collector = new DetailCollector();
  const sections: DiagramSection[] = [];
  for (const scenario of scenarios) {
    const lines: string[] = [];
    for (const spans of scenario.traces) {
      const traceLines: string[] = [];
      const drawn = new Set<string>();
      emitTrace(spans, traceLines, drawn, options, collector, operations);
      if (traceLines.length === 0) continue;
      drawn.forEach((p) => present.add(p));
      lines.push(...traceLines);
    }
    if (lines.length === 0) continue;
    sections.push({title: scenario.title, lines});
  }

  const kinds = revealable(options);
  // The marker is a hyperlink, and a link that shouts blue-and-underlined would
  // read as the arrow's subject rather than as a handle beside it.
  const interactiveHeader = options.interactive ? [
    'skinparam hyperlinkUnderline false',
    'skinparam hyperlinkColor #1A4FA0',
  ] : [];
  const interactiveLegend = options.interactive && kinds.length > 0 ? [
    ` `,
    `  This picture is deliberately simplified. In review/review.html, click a`,
    `  highlighted arrow to reveal that one call's ${kinds.join(' / ')} —`,
    `  a DB arrow's panel toggles between ? and the values that were bound.`,
  ] : [];

  const header = [
    '@startuml',
    // ' starts a PlantUML comment: this one warns whoever opens the *file*.
    // Everything a reader of the *image* needs is in the legend below instead —
    // a comment never reaches the rendered diagram, and the picture is what
    // ends up pasted in a review, a slide or a wiki page.
    `' ⚠️  GENERATED FILE — DO NOT EDIT. Every edit is lost on the next run.`,
    'hide footbox',
    ...interactiveHeader,
    `title ${title}`,
    'legend right',
    `  ⚠️  GENERATED FILE — DO NOT EDIT. Every edit is lost on the next run.`,
    `  Drawn from real Tempo traces of ${title}, for the scenarios tagged`,
    `  @generate_sequence. Change the test, not this file, then regenerate with`,
    `  petclinic-test/run-tests-with-tracing.sh`,
    ...interactiveLegend,
    ` `,
    `  Detail shown here: ${describeOptions(options)}`,
    `  Want more or less? The traces already carry all of it — re-rendering replays`,
    `  the spans cached in test-results/trace-spans.json (~1s): nothing has to run,`,
    `  not even Grafana (GENSEQ_REFRESH=1 re-fetches from Tempo instead):`,
    `      cd petclinic-test`,
    `      npm run diagram:reveal  # simplified, click to reveal SQL + payloads`,
    `      npm run diagram:lean    # baked in: call flow only`,
    `      npm run diagram:static  # baked in: + the SQL statements`,
    `      npm run diagram:full    # baked in: + bound parameter values + JSON payloads`,
    `      SEQ_SQL=off|statement|values SEQ_HTTP_BODIES=0|1 SEQ_INTERACTIVE=0|1 npm run trace:diagram`,
    'end legend',
    // footer (bottom of every page) states the diagram's provenance
    'footer @generate_sequence — generated from real traces, do not edit',
    ...orderedParticipants(present).map((p) => `participant ${p}`),
  ];
  const body = sections.flatMap((s) => [`== ${s.title} ==`, ...s.lines]);
  return {
    puml: [...header, ...body, '@enduml', ''].join('\n'),
    details: collector.toIndex(),
  };
}

export function renderPuml(
  title: string,
  scenarios: DiagramScenario[],
  options: DiagramOptions = DEFAULT_DIAGRAM_OPTIONS,
  operations: OperationNames = defaultOperations(),
): string {
  return renderDiagram(title, scenarios, options, operations).puml;
}

interface DiagramSection {
  title: string;
  lines: string[];
}

export function spansToPuml(
  spans: NormSpan[], title: string, options?: DiagramOptions, operations?: OperationNames,
): string {
  return renderPuml(title, [{title, traces: [spans]}], options, operations);
}
