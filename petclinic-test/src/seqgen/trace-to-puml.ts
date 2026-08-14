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
  const isDb = 'db.system' in span.attributes || 'db.statement' in span.attributes
    || DB_NAME_RE.test(span.name);
  if (span.kind === 'CLIENT' && isDb) return 'DB';
  if (span.serviceName === 'petclinic-backend') return 'Backend';
  return span.serviceName || 'unknown';
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

function emitTrace(spans: NormSpan[], lines: string[], present: Set<string>): void {
  const byId = new Map(spans.map((s) => [s.spanId, s]));
  const childrenOf = (id: string) => spans
    .filter((s) => s.parentSpanId === id)
    .sort((a, b) => a.startNano - b.startNano);

  const walk = (span: NormSpan): void => {
    const p = participantOf(span);
    present.add(p);
    const parent = span.parentSpanId ? byId.get(span.parentSpanId) : undefined;
    const pp = parent ? participantOf(parent) : undefined;
    const crossing = pp !== undefined && pp !== p;
    const selfCustom = pp === p && span.kind === 'INTERNAL';

    if (crossing) {
      lines.push(`${pp} -> ${p}: ${span.name}`);
      lines.push(`activate ${p}`);
    } else if (selfCustom) {
      // a self-span (e.g. @WithSpan) opens a nested activation so its own
      // children — DB calls, downstream requests — render inside its lifetime
      lines.push(`${p} -> ${p}: ${span.name}`);
      lines.push(`activate ${p}`);
    }

    for (const child of childrenOf(span.spanId)) walk(child);

    if (crossing) {
      const label = returnLabel(span);
      if (label) lines.push(`${p} --> ${pp}: ${label}`);
      lines.push(`deactivate ${p}`);
    } else if (selfCustom) {
      lines.push(`deactivate ${p}`);
    }
  };

  const roots = spans
    .filter((s) => !s.parentSpanId || !byId.has(s.parentSpanId))
    .sort((a, b) => a.startNano - b.startNano);
  for (const root of roots) walk(root);
}

/** One tagged test, with every trace its interactions produced. */
export interface DiagramScenario {
  title: string;
  traces: NormSpan[][];
}

export function renderPuml(title: string, scenarios: DiagramScenario[]): string {
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
      emitTrace(spans, traceLines, drawn);
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

export function spansToPuml(spans: NormSpan[], title: string): string {
  return renderPuml(title, [{title, traces: [spans]}]);
}
