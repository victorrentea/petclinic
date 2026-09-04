import {formatOriginLabel, formatSqlDetail, formatSqlLabel, splitOrigin, summarizeStatement} from './sql-label';
import {formatJsonDetail, jsonNote} from './json-label';
import {DEFAULT_DIAGRAM_OPTIONS, DiagramOptions} from './options';
import {DetailCollector, DetailIndex, DetailStep} from './detail-index';
import {OperationNames, defaultOperations, operationNameOf} from './openapi-operations';
import {linkedSectionTitle} from './test-location';

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

// Hibernate writes a placeholder instead of query text when there was no query text to
// write: a Spring Data *derived* method is assembled through the Criteria API, so its
// comment reads `/* <criteria> */`. That names the mechanism, never the call.
const ORIGIN_PLACEHOLDER = /^<[a-z]+>$/i;

// `Session.find victor.training.petclinic.domain.Owner` — the package is the same for
// every domain class in the trace, so it is nine words of nothing on an arrow.
const QUALIFIED_NAME = /\b(?:[a-z][\w$]*\.)+([A-Z][\w$]*)/g;

function unqualify(name: string): string {
  return name.replace(QUALIFIED_NAME, '$1');
}

/**
 * What the arrow into this span says. For a DB hop that is the *call* the query came
 * from, not the query — which is the grain a reviewer reads a sequence diagram at, and
 * the one thing `SELECT petclinic`, repeated twenty times down an N+1, cannot tell them.
 * The SQL stays one click away.
 *
 * Three sources, best first, because no single one covers every query:
 *
 *   1. Hibernate's own comment on the statement (`hibernate.use_sql_comments`) — the
 *      real HQL, but only for a query written as HQL: an `@Query` method.
 *   2. the Spring Data repository method above it — what a derived method has instead of
 *      HQL, since Hibernate only says `<criteria>` for those;
 *   3. the Hibernate session call above it — `Session.find Owner`, which is what a lazy
 *      load or a `findById` has instead of either.
 *
 * The span name is the last resort and a poor one; it appears when a trace was recorded
 * without any of the above, e.g. against a backend older than `use_sql_comments`.
 */
function arrowLabel(
  span: NormSpan, target: string, options: DiagramOptions, operations: OperationNames,
  caller?: string,
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
  const spoken = origin && !ORIGIN_PLACEHOLDER.test(origin) ? formatOriginLabel(origin) : undefined;
  const account = spoken ?? caller ?? summarizeStatement(sql);
  if (options.interactive) return account ?? span.name;
  // A baked-in diagram is asked for precisely to have the statement on the page, so it
  // gets both grains: Hibernate's account, then the SQL it compiled to.
  // The values go in *after* the statement is folded into clauses — a bound value
  // reading "Follow up on the vaccination" would otherwise be folded at its own ON.
  const statement = formatSqlLabel(sql, options.sql === 'values' ? parametersOf(span) : []);
  return account ? `${account}\\n${statement}` : statement;
}

// The handle a reader clicks. PlantUML turns `[[scheme://id{tooltip} text]]` into an
// <a href> around its own <text> run in the SVG, which is a stable, generation-time
// anchor for the id — nothing downstream has to match rendered label text.
//
// The link wraps the whole label *and* keeps the ⊕ inside it. Those answer two different
// questions: the wrapped label makes the arrow the click target, so a reviewer who wants
// to click it can aim at the words rather than at a glyph; the ⊕ is what says there is
// anything to click at all. Drop it and a diagram read outside review.html — a raw .puml,
// an SVG in a PR — offers no hint that an arrow hides a statement.
const MARKER_SCHEME = 'genseq://';
const MARKER_GLYPH = '⊕';

/** `label`, wrapped in the link that reveals `steps` — or bare, when there is nothing to reveal. */
function linkLabel(
  label: string, collector: DetailCollector, title: string, steps: DetailStep[], tooltip: string,
): string {
  if (steps.length === 0) return label;
  const id = collector.add({title, steps});
  return `[[${MARKER_SCHEME}${id}{${tooltip}} ${label} ${MARKER_GLYPH}]]`;
}

const SQL_TOOLTIP = 'Click for the statement behind this call';
const BODY_TOOLTIP = 'Click for this call’s JSON body';

/**
 * One step: the statement as Hibernate sent it. The bound values ride along as the
 * step's alternate, which the panel offers as a toggle rather than as a second click —
 * a click that swaps the text under you reads as a bug until you have seen it twice,
 * and a `1 / 2` counter is not a discoverable way to say "there is more".
 *
 * Neither carries a label. "statement as sent — ? for each bound value" described the
 * toggle's own state, which the toggle already shows, above a block of SQL whose `?`s
 * are right there to see; the panel's title says which call this is, and that is the
 * only thing a reader does not already have in front of them.
 */
function sqlSteps(span: NormSpan, options: DiagramOptions): DetailStep[] {
  if (!options.interactive || options.sql === 'off') return [];
  const sql = sqlOf(span);
  if (!sql) return [];
  const parameters = parametersOf(span);
  return [{
    label: '',
    text: formatSqlDetail(sql),
    ...(parameters.length > 0 ? {
      alternate: {label: '', text: formatSqlDetail(sql, parameters)},
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

// The commit the transaction interceptor issues on the way out. It is emitted as the last
// child of whatever span opened the transaction, which is what lets the diagram draw the
// *scope* rather than just the moment: a bare `Transaction.commit` arrow says a
// transaction ended somewhere above, and leaves the reader to guess how far up.
const TRANSACTION_COMMIT = 'Transaction.commit';

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

  /**
   * A span that opened a transaction: the interceptor committed inside it.
   *
   * In this codebase that is every Spring Data repository method, because nothing above
   * them is `@Transactional` — so each call gets its own transaction and its own session,
   * which is a fact about the design worth being able to see.
   */
  const opensTransaction = (span: NormSpan): boolean =>
    childrenOf(span.spanId).some((c) => c.name === TRANSACTION_COMMIT);

  // Just `tx`. The frame's job is to show an *extent*, and whatever opened it is named
  // by the call the frame sits inside — a longer label only repeats that.
  const TRANSACTION_LABEL = 'tx';

  const nearestAncestor = (span: NormSpan, matches: RegExp): NormSpan | undefined => {
    for (let up = span.parentSpanId ? byId.get(span.parentSpanId) : undefined;
      up; up = up.parentSpanId ? byId.get(up.parentSpanId) : undefined) {
      if (matches.test(up.name)) return up;
    }
    return undefined;
  };

  // Who asked for this query — the repository method if there is one, else the session
  // call. Both are already in the trace; the diagram drops them as arrows precisely
  // because they belong *on* the query.
  const callerOf = (span: NormSpan): string | undefined => {
    const source = nearestAncestor(span, REPOSITORY_SPAN_RE)
      ?? nearestAncestor(span, HIBERNATE_SPAN_RE);
    // A caller drawn as the frame around this query has already named it; repeating the
    // name on the arrow inside its own box says the same thing twice.
    if (!source || opensTransaction(source)) return undefined;
    return unqualify(source.name);
  };


  const walk = (span: NormSpan, out: string[], parentParticipant?: string): void => {
    // Whatever the driver does inside a query is the database's business: drawing a
    // child of a DB span would put an arrow *out* of the DB lifeline, as if the
    // database were calling the backend back.
    if (parentParticipant === 'DB') return;

    // The commit is the closing edge of the frame drawn below — an arrow for it as well
    // would draw the same event twice, once as a boundary and once as a message.
    const parentSpan = span.parentSpanId ? byId.get(span.parentSpanId) : undefined;
    if (span.name === TRANSACTION_COMMIT && parentSpan && opensTransaction(parentSpan)) return;

    const p = participantOf(span);
    const parent = parentSpan;
    const pp = parent ? participantOf(parent) : undefined;
    const crossing = pp !== undefined && pp !== p;
    // A repository call is drawn as a call: a self-hop, an activation, and its statements
    // fired from inside it. That is the shape a reader expects of a method that queries,
    // and it gives the transaction frame somewhere to sit.
    const selfCustom = pp === p && span.kind === 'INTERNAL'
      && !(HIBERNATE_SPAN_RE.test(span.name)
        && nearestAncestor(span, REPOSITORY_SPAN_RE) !== undefined);

    // Draw the subtree first: an activation bar is only worth its vertical space
    // when something is drawn *inside* it. A call that reaches nobody — a leaf DB
    // query, a self-span with no children — gets a bare arrow instead.
    const inner: string[] = [];
    for (const child of childrenOf(span.spanId)) walk(child, inner, p);

    // A transaction's scope is a region of the conversation, not a message in it, so it is
    // drawn as a frame around everything that ran inside it. The reader can then see which
    // queries shared a transaction and a Hibernate session — and, just as usefully, which
    // ones ran outside every frame, as the lazy loads of an N+1 do.
    //
    // The frame wraps the *inside* of the span, never the span's own arrow: when the
    // transaction is opened by the request handler itself — `@Transactional` on a
    // controller method — framing the span would swallow the request and the response
    // with it, and the picture would lose the call it is about.
    const body = opensTransaction(span) && inner.length > 0
      ? [`group ${TRANSACTION_LABEL}`, ...inner, 'end']
      : inner;

    if (!crossing && !selfCustom) {
      present.add(p);
      out.push(...body);
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
      const text = arrowLabel(span, p, options, operations, p === 'DB' ? callerOf(span) : undefined);
      // The panel is titled with what the arrow says, not with the span's generic name:
      // a reader who clicked `OwnerRepository.findById` should not be told the thing they
      // opened is called `SELECT petclinic.owners`.
      const title = p === 'DB' ? text : `${pp} → ${p}: ${span.name}`;
      const tooltip = p === 'DB' ? SQL_TOOLTIP : BODY_TOOLTIP;
      const label = linkLabel(text, collector, title, steps, tooltip);
      out.push(`${pp} -> ${p}: ${label}`);
      if (bodies) out.push(...jsonNote(bodies, bodyOf(span, parent, 'http.request.body')));
    } else {
      // a self-span (e.g. @WithSpan) whose children — DB calls, downstream
      // requests — render inside its own lifetime
      present.add(p);
      out.push(`${p} -> ${p}: ${span.name}`);
    }

    if (inner.length > 0) out.push(`activate ${p}`);
    out.push(...body);
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
  /** `src://path:line` of the test this section came from, when it could be located. */
  link?: string;
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
    sections.push({title: scenario.title, link: scenario.link, lines});
  }

  // The marker is a hyperlink, and a link that shouts blue-and-underlined would
  // read as the arrow's subject rather than as a handle beside it.
  const interactiveHeader = options.interactive ? [
    'skinparam hyperlinkUnderline false',
    'skinparam hyperlinkColor #1A4FA0',
  ] : [];

  const header = [
    '@startuml',
    // ' starts a PlantUML comment: this one warns whoever opens the *file*.
    // The legend below repeats it for a reader of the *image* — a comment never
    // reaches the rendered diagram, and the picture is what ends up pasted in a
    // review, a slide or a wiki page.
    `' ⚠️  GENERATED FILE — DO NOT EDIT. Every edit is lost on the next run.`,
    'hide footbox',
    ...interactiveHeader,
    `title ${title}`,
    // The warning, and nothing else. How the picture was recorded, how to re-render
    // it at another detail level and which npm script does that is documentation
    // about the tool; it belongs in petclinic-test/AGENTS.md and the README, not
    // drawn beside the conversation the diagram exists to show.
    'legend right',
    `  ⚠️  GENERATED FILE — DO NOT EDIT. Every edit is lost on the next run.`,
    'end legend',
    // footer (bottom of every page) states the diagram's provenance
    'footer @generate_sequence — generated from real traces, do not edit',
    ...orderedParticipants(present).map((p) => `participant ${p}`),
  ];
  // The header is the one place the picture can say which test produced it, so it is
  // also the place to put the link there: PlantUML renders a creole link inside a
  // divider, and the review page resolves the handle against its own checkout.
  const body = sections.flatMap(
    (s) => [`== ${linkedSectionTitle(s.title, s.link)} ==`, ...s.lines]);
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
  link?: string;
  lines: string[];
}

export function spansToPuml(
  spans: NormSpan[], title: string, options?: DiagramOptions, operations?: OperationNames,
): string {
  return renderPuml(title, [{title, traces: [spans]}], options, operations);
}
