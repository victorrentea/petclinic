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

function returnLabel(span: NormSpan): string {
  return span.attributes['http.status_code']
    ?? span.attributes['http.response.status_code']
    ?? 'return';
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
      lines.push(`${p} -> ${p}: ${span.name}`);
    }

    for (const child of childrenOf(span.spanId)) walk(child);

    if (crossing) {
      lines.push(`${p} --> ${pp}: ${returnLabel(span)}`);
      lines.push(`deactivate ${p}`);
    }
  };

  const roots = spans
    .filter((s) => !s.parentSpanId || !byId.has(s.parentSpanId))
    .sort((a, b) => a.startNano - b.startNano);
  for (const root of roots) walk(root);
}

export function renderPuml(title: string, traces: NormSpan[][], footerPath?: string): string {
  const body: string[] = [];
  const present = new Set<string>();
  traces.forEach((spans, i) => {
    if (traces.length > 1) body.push(`== ${title} #${i + 1} ==`);
    emitTrace(spans, body, present);
  });

  const header = [
    '@startuml',
    'hide footbox',
    `title ${title}`,
    `caption generated from test "${title}"`,
    // footer marks the diagram's own repo-relative source path in the render
    ...(footerPath ? [`footer ${footerPath}`] : []),
    ...orderedParticipants(present).map((p) => `participant ${p}`),
  ];
  return [...header, ...body, '@enduml', ''].join('\n');
}

export function spansToPuml(spans: NormSpan[], title: string): string {
  return renderPuml(title, [spans]);
}
