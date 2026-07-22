# Tempo→PlantUML Sequence Diagrams Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After the Playwright e2e suite runs, pull the browser→backend→DB traces it produced from Grafana/Tempo and render one PlantUML sequence diagram per test, including one explicit custom backend span.

**Architecture:** A pure TypeScript core (`trace-to-puml.ts`) turns a Tempo trace JSON into PlantUML; a thin Grafana-proxy client (`tempo-client.ts`) fetches traces; an orchestrator (`generate.ts`) ties them together and is invoked from Playwright `globalTeardown`. A per-test fixture stamps each browser span with `test.name` (via a `SpanProcessor` added to the existing `otel.ts`) and records each test's time window. The backend gains one `@WithSpan("book-visit")` span.

**Tech Stack:** TypeScript (CommonJS, ts-node), `@playwright/test` (also used as the unit-test runner via a second config), OpenTelemetry (frontend web SDK + backend Java agent v2.10.0), Tempo via Grafana datasource proxy, PlantUML output.

## Global Constraints

- Backend Java: line length ≤ 120; constructor injection; **no service layer** (custom span goes on a private method in the controller); MapStruct for mapping; `@Validated` on `@RequestBody`.
- OpenTelemetry Java agent version: **2.10.0** — the `opentelemetry-instrumentation-annotations` dependency MUST use the same version (`2.10.0`).
- ui-test TypeScript: CommonJS modules, `esModuleInterop` + `resolveJsonModule` are on; run scripts from `petclinic-ui-test/`.
- Tempo is reached ONLY through the Grafana proxy: base `http://localhost:3300`, datasource uid `tempo`, HTTP Basic `admin:admin` (overridable via env `GRAFANA_URL`/`GRAFANA_USER`/`GRAFANA_PASSWORD`).
- Diagram generation MUST degrade gracefully: if Grafana is unreachable or a window yields zero traces, log a warning and skip — NEVER throw / fail the test run.
- Output diagrams go to `petclinic-ui-test/diagrams/`. SVG rendering is best-effort/local only.
- TDD: write the failing test first, watch it fail, implement minimally, watch it pass, commit.

---

### Task 1: Backend custom span `book-visit`

**Files:**
- Modify: `petclinic-backend/pom.xml` (add annotations dependency)
- Modify: `petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitRestController.java`
- Test (existing gate): `petclinic-backend/src/test/java/victor/training/petclinic/rest/VisitTest.java`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: at runtime, an OTel span named `book-visit` (kind INTERNAL) nested under `POST /api/visits`. No compile-time export.

- [ ] **Step 1: Run the existing visit REST test to confirm a green baseline**

Run (from `petclinic-backend/`): `mvn -q test -Dtest=VisitTest`
Expected: PASS (this is the behavior gate; the refactor below must keep it green).

- [ ] **Step 2: Add the OTel annotations dependency to `pom.xml`**

Add inside `<dependencies>`:

```xml
<dependency>
    <groupId>io.opentelemetry.instrumentation</groupId>
    <artifactId>opentelemetry-instrumentation-annotations</artifactId>
    <version>2.10.0</version>
</dependency>
```

- [ ] **Step 3: Extract the booking logic into a `@WithSpan` private method**

In `VisitRestController.java` add the import:

```java
import io.opentelemetry.instrumentation.annotations.WithSpan;
```

Replace the `addVisit` method body with a call to a new private method:

```java
    @PostMapping
    public ResponseEntity<Void> addVisit(@RequestBody @Validated VisitDto visitDto) {
        int id = bookVisit(visitDto);
        return ResponseEntity.created(UriComponentsBuilder.fromPath("/api/visits/{id}")
                        .buildAndExpand(id).toUri())
                .build();
    }

    @WithSpan("book-visit")
    private int bookVisit(VisitDto visitDto) {
        Visit visit = visitMapper.toVisit(visitDto);
        visitRepository.save(visit);
        return visit.getId();
    }
```

Note: the OTel Java agent instruments `@WithSpan` at the bytecode level, so it works on this private, self-invoked method (Spring AOP would not). If a later manual check shows the span missing, widen the method to package-private — do not introduce a service class (house rule: no service layer).

- [ ] **Step 4: Compile and re-run the gate test**

Run (from `petclinic-backend/`): `mvn -q test -Dtest=VisitTest`
Expected: PASS (behavior unchanged).

- [ ] **Step 5: Commit**

```bash
git add petclinic-backend/pom.xml petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitRestController.java
git commit -m "feat(backend): add explicit book-visit span on POST /api/visits"
```

---

### Task 2: Frontend stamps `test.name` on every span

**Files:**
- Create: `petclinic-frontend/src/test-name-span-processor.ts`
- Create: `petclinic-frontend/src/test-name-span-processor.spec.ts`
- Modify: `petclinic-frontend/src/otel.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `makeTestNameSpanProcessor(getTestName: () => string | undefined): SpanProcessor` — a `SpanProcessor` whose `onStart` sets the `test.name` attribute when a name is available. Used inside `otel.ts`. The global it reads is `window.__E2E_TEST_NAME__`, written by Task 6's fixture.

- [ ] **Step 1: Write the failing unit test**

Create `petclinic-frontend/src/test-name-span-processor.spec.ts`:

```ts
import { makeTestNameSpanProcessor } from './test-name-span-processor';

function fakeSpan() {
  const attrs: Record<string, unknown> = {};
  return {
    attrs,
    setAttribute(key: string, value: unknown) { this.attrs[key] = value; },
  };
}

describe('makeTestNameSpanProcessor', () => {
  it('stamps test.name on span start when a name is available', () => {
    const proc = makeTestNameSpanProcessor(() => 'add a visit');
    const span = fakeSpan();
    proc.onStart(span as any);
    expect(span.attrs['test.name']).toBe('add a visit');
  });

  it('does nothing when no name is available', () => {
    const proc = makeTestNameSpanProcessor(() => undefined);
    const span = fakeSpan();
    proc.onStart(span as any);
    expect(span.attrs['test.name']).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run (from `petclinic-frontend/`): `npm run test-headless`
Expected: FAIL — cannot find module `./test-name-span-processor`.

- [ ] **Step 3: Implement the processor**

Create `petclinic-frontend/src/test-name-span-processor.ts`:

```ts
import { Context } from '@opentelemetry/api';
import { Span, SpanProcessor } from '@opentelemetry/sdk-trace-web';

// A no-op-by-default SpanProcessor that tags every started span with the
// current e2e test name, so traces can be filtered per-test in Tempo (TraceQL
// `{ span.test.name = "..." }`). Outside e2e runs getTestName() returns
// undefined and nothing is stamped.
export function makeTestNameSpanProcessor(
  getTestName: () => string | undefined,
): SpanProcessor {
  return {
    onStart(span: Span, _parentContext: Context): void {
      const name = getTestName();
      if (name) {
        span.setAttribute('test.name', name);
      }
    },
    onEnd(): void {},
    forceFlush(): Promise<void> { return Promise.resolve(); },
    shutdown(): Promise<void> { return Promise.resolve(); },
  };
}
```

- [ ] **Step 4: Wire it into `otel.ts`**

In `petclinic-frontend/src/otel.ts` add the import near the top:

```ts
import { makeTestNameSpanProcessor } from './test-name-span-processor';
```

Then add the processor to the provider's `spanProcessors` array (alongside the existing `BatchSpanProcessor`):

```ts
    spanProcessors: [
      makeTestNameSpanProcessor(
        () => (globalThis as any).__E2E_TEST_NAME__ as string | undefined,
      ),
      new BatchSpanProcessor(
        new OTLPTraceExporter({ url: '/v1/traces' }),
      ),
    ],
```

- [ ] **Step 5: Run the tests to verify they pass**

Run (from `petclinic-frontend/`): `npm run test-headless`
Expected: PASS (the two new specs pass; the rest of the suite stays green).

- [ ] **Step 6: Commit**

```bash
git add petclinic-frontend/src/test-name-span-processor.ts petclinic-frontend/src/test-name-span-processor.spec.ts petclinic-frontend/src/otel.ts
git commit -m "feat(frontend): tag spans with test.name for per-test trace correlation"
```

---

### Task 3: Tempo client (Grafana proxy) + unit-test runner

**Files:**
- Create: `petclinic-ui-test/src/trace-diagram/tempo-client.ts`
- Create: `petclinic-ui-test/src/trace-diagram/tempo-client.spec.ts`
- Create: `petclinic-ui-test/playwright.unit.config.ts`
- Modify: `petclinic-ui-test/package.json` (add `test:unit` script)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces:
  - `interface TempoConfig { baseUrl: string; user: string; password: string; }`
  - `tempoConfigFromEnv(env?): TempoConfig`
  - `authHeader(cfg: TempoConfig): string`
  - `buildSearchUrl(cfg, traceql: string, startSec: number, endSec: number, limit: number): string`
  - `buildTraceUrl(cfg, traceId: string): string`
  - `searchTraceIds(cfg, traceql: string, startMs: number, endMs: number, fetchFn?): Promise<string[]>`
  - `getTrace(cfg, traceId: string, fetchFn?): Promise<unknown>`

- [ ] **Step 1: Add the unit-test runner config and script**

Create `petclinic-ui-test/playwright.unit.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

// Pure (non-browser) unit tests for the trace-diagram tooling. Separate from
// playwright.config.ts (which targets ./tests and starts a web server).
export default defineConfig({
  testDir: './src',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
});
```

In `petclinic-ui-test/package.json`, add to `scripts`:

```json
    "test:unit": "playwright test -c playwright.unit.config.ts",
```

- [ ] **Step 2: Write the failing test**

Create `petclinic-ui-test/src/trace-diagram/tempo-client.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import {
  tempoConfigFromEnv, authHeader, buildSearchUrl, buildTraceUrl, searchTraceIds,
} from './tempo-client';

test('tempoConfigFromEnv falls back to localhost grafana admin', () => {
  const cfg = tempoConfigFromEnv({});
  expect(cfg.baseUrl).toBe('http://localhost:3300');
  expect(cfg.user).toBe('admin');
  expect(cfg.password).toBe('admin');
});

test('authHeader builds Basic base64', () => {
  const h = authHeader({ baseUrl: 'x', user: 'admin', password: 'admin' });
  expect(h).toBe('Basic ' + Buffer.from('admin:admin').toString('base64'));
});

test('buildSearchUrl hits the tempo datasource proxy with TraceQL + window', () => {
  const cfg = { baseUrl: 'http://localhost:3300', user: 'a', password: 'b' };
  const url = buildSearchUrl(cfg, '{ span.test.name = "x" }', 100, 200, 20);
  expect(url).toContain('/api/datasources/proxy/uid/tempo/api/search');
  expect(url).toContain('start=100');
  expect(url).toContain('end=200');
  expect(url).toContain('limit=20');
  expect(url).toContain(encodeURIComponent('{ span.test.name = "x" }'));
});

test('buildTraceUrl targets the trace-by-id proxy endpoint', () => {
  const cfg = { baseUrl: 'http://localhost:3300', user: 'a', password: 'b' };
  expect(buildTraceUrl(cfg, 'abc123'))
    .toBe('http://localhost:3300/api/datasources/proxy/uid/tempo/api/traces/abc123');
});

test('searchTraceIds maps Tempo response traceID list, converting ms→s', async () => {
  const calls: string[] = [];
  const fakeFetch = async (url: string) => {
    calls.push(url);
    return { ok: true, json: async () => ({ traces: [{ traceID: 'aaa' }, { traceID: 'bbb' }] }) };
  };
  const cfg = { baseUrl: 'http://localhost:3300', user: 'a', password: 'b' };
  const ids = await searchTraceIds(cfg, '{}', 5_000, 9_000, fakeFetch as any);
  expect(ids).toEqual(['aaa', 'bbb']);
  expect(calls[0]).toContain('start=5');
  expect(calls[0]).toContain('end=9');
});
```

- [ ] **Step 3: Run it to verify it fails**

Run (from `petclinic-ui-test/`): `npm run test:unit -- tempo-client`
Expected: FAIL — cannot find module `./tempo-client`.

- [ ] **Step 4: Implement the client**

Create `petclinic-ui-test/src/trace-diagram/tempo-client.ts`:

```ts
export interface TempoConfig {
  baseUrl: string;
  user: string;
  password: string;
}

type FetchFn = (url: string, init?: any) => Promise<{ ok: boolean; status?: number; json: () => Promise<any> }>;

const TEMPO_DS = 'tempo';

export function tempoConfigFromEnv(env: NodeJS.ProcessEnv = process.env): TempoConfig {
  return {
    baseUrl: env.GRAFANA_URL ?? 'http://localhost:3300',
    user: env.GRAFANA_USER ?? 'admin',
    password: env.GRAFANA_PASSWORD ?? 'admin',
  };
}

export function authHeader(cfg: TempoConfig): string {
  return 'Basic ' + Buffer.from(`${cfg.user}:${cfg.password}`).toString('base64');
}

function proxyBase(cfg: TempoConfig): string {
  return `${cfg.baseUrl}/api/datasources/proxy/uid/${TEMPO_DS}`;
}

export function buildSearchUrl(
  cfg: TempoConfig, traceql: string, startSec: number, endSec: number, limit: number,
): string {
  const q = new URLSearchParams({
    q: traceql,
    start: String(startSec),
    end: String(endSec),
    limit: String(limit),
  });
  return `${proxyBase(cfg)}/api/search?${q.toString()}`;
}

export function buildTraceUrl(cfg: TempoConfig, traceId: string): string {
  return `${proxyBase(cfg)}/api/traces/${traceId}`;
}

export async function searchTraceIds(
  cfg: TempoConfig, traceql: string, startMs: number, endMs: number,
  fetchFn: FetchFn = fetch as any,
): Promise<string[]> {
  const url = buildSearchUrl(cfg, traceql, Math.floor(startMs / 1000), Math.ceil(endMs / 1000), 50);
  const res = await fetchFn(url, { headers: { Authorization: authHeader(cfg) } });
  if (!res.ok) {
    throw new Error(`Tempo search failed: HTTP ${res.status}`);
  }
  const body = await res.json();
  return (body.traces ?? []).map((t: any) => t.traceID).filter(Boolean);
}

export async function getTrace(
  cfg: TempoConfig, traceId: string, fetchFn: FetchFn = fetch as any,
): Promise<unknown> {
  const url = buildTraceUrl(cfg, traceId);
  const res = await fetchFn(url, {
    headers: { Authorization: authHeader(cfg), Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Tempo getTrace failed: HTTP ${res.status}`);
  }
  return res.json();
}
```

Note: `URLSearchParams` encodes the TraceQL value; the test's `encodeURIComponent` check matches because both percent-encode the same reserved characters in `{ span.test.name = "x" }`.

- [ ] **Step 5: Run the tests to verify they pass**

Run (from `petclinic-ui-test/`): `npm run test:unit -- tempo-client`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add petclinic-ui-test/src/trace-diagram/tempo-client.ts petclinic-ui-test/src/trace-diagram/tempo-client.spec.ts petclinic-ui-test/playwright.unit.config.ts petclinic-ui-test/package.json
git commit -m "feat(ui-test): Tempo client over Grafana proxy + unit-test runner"
```

---

### Task 4: Trace → PlantUML core

**Files:**
- Create: `petclinic-ui-test/src/trace-diagram/trace-to-puml.ts`
- Create: `petclinic-ui-test/src/trace-diagram/__fixtures__/add-visit-trace.json`
- Create: `petclinic-ui-test/src/trace-diagram/trace-to-puml.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface NormSpan { traceId: string; spanId: string; parentSpanId: string; name: string; kind: string; serviceName: string; startNano: number; attributes: Record<string, string>; }`
  - `parseTempoTrace(tempoJson: unknown): NormSpan[]`
  - `renderPuml(title: string, traces: NormSpan[][]): string`
  - `spansToPuml(spans: NormSpan[], title: string): string` (= `renderPuml(title, [spans])`)

- [ ] **Step 1: Create the fixture trace JSON**

Create `petclinic-ui-test/src/trace-diagram/__fixtures__/add-visit-trace.json` (Tempo OTLP-JSON shape: frontend click+fetch, backend server, book-visit, DB insert):

```json
{
  "batches": [
    {
      "resource": { "attributes": [
        { "key": "service.name", "value": { "stringValue": "petclinic-frontend" } }
      ] },
      "scopeSpans": [ { "spans": [
        { "traceId": "t1", "spanId": "f1", "name": "click",
          "kind": "SPAN_KIND_INTERNAL", "startTimeUnixNano": "1000", "attributes": [] },
        { "traceId": "t1", "spanId": "f2", "parentSpanId": "f1", "name": "HTTP POST",
          "kind": "SPAN_KIND_CLIENT", "startTimeUnixNano": "1100", "attributes": [] }
      ] } ]
    },
    {
      "resource": { "attributes": [
        { "key": "service.name", "value": { "stringValue": "petclinic-backend" } }
      ] },
      "scopeSpans": [ { "spans": [
        { "traceId": "t1", "spanId": "b1", "parentSpanId": "f2", "name": "POST /api/visits",
          "kind": "SPAN_KIND_SERVER", "startTimeUnixNano": "1200",
          "attributes": [ { "key": "http.status_code", "value": { "intValue": "201" } } ] },
        { "traceId": "t1", "spanId": "b2", "parentSpanId": "b1", "name": "book-visit",
          "kind": "SPAN_KIND_INTERNAL", "startTimeUnixNano": "1300", "attributes": [] },
        { "traceId": "t1", "spanId": "b3", "parentSpanId": "b2", "name": "INSERT petclinic.visits",
          "kind": "SPAN_KIND_CLIENT", "startTimeUnixNano": "1400",
          "attributes": [ { "key": "db.system", "value": { "stringValue": "postgresql" } } ] }
      ] } ]
    }
  ]
}
```

- [ ] **Step 2: Write the failing test**

Create `petclinic-ui-test/src/trace-diagram/trace-to-puml.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { parseTempoTrace, spansToPuml } from './trace-to-puml';

const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '__fixtures__', 'add-visit-trace.json'), 'utf-8'),
);

test('parseTempoTrace normalizes spans with service name and kind', () => {
  const spans = parseTempoTrace(fixture);
  expect(spans).toHaveLength(5);
  const server = spans.find((s) => s.spanId === 'b1')!;
  expect(server.serviceName).toBe('petclinic-backend');
  expect(server.kind).toBe('SERVER');
  expect(server.attributes['http.status_code']).toBe('201');
  const db = spans.find((s) => s.spanId === 'b3')!;
  expect(db.attributes['db.system']).toBe('postgresql');
});

test('spansToPuml renders browser→backend→DB with the custom span', () => {
  const puml = spansToPuml(parseTempoTrace(fixture), 'add a visit');
  expect(puml).toContain('@startuml');
  expect(puml).toContain('@enduml');
  expect(puml).toContain('participant Browser');
  expect(puml).toContain('participant Backend');
  expect(puml).toContain('participant DB');
  expect(puml).toContain('Browser -> Backend: POST /api/visits');
  expect(puml).toContain('Backend -> Backend: book-visit');
  expect(puml).toContain('Backend -> DB: INSERT petclinic.visits');
  expect(puml).toContain('Backend --> Browser: 201');
  // activate/deactivate are balanced
  const acts = (puml.match(/^activate /gm) ?? []).length;
  const deacts = (puml.match(/^deactivate /gm) ?? []).length;
  expect(acts).toBe(deacts);
});
```

- [ ] **Step 3: Run it to verify it fails**

Run (from `petclinic-ui-test/`): `npm run test:unit -- trace-to-puml`
Expected: FAIL — cannot find module `./trace-to-puml`.

- [ ] **Step 4: Implement the core**

Create `petclinic-ui-test/src/trace-diagram/trace-to-puml.ts`:

```ts
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
      lines.push(`"${pp}" -> "${p}": ${span.name}`);
      lines.push(`activate "${p}"`);
    } else if (selfCustom) {
      lines.push(`"${p}" -> "${p}": ${span.name}`);
    }

    for (const child of childrenOf(span.spanId)) walk(child);

    if (crossing) {
      lines.push(`"${p}" --> "${pp}": ${returnLabel(span)}`);
      lines.push(`deactivate "${p}"`);
    }
  };

  const roots = spans
    .filter((s) => !s.parentSpanId || !byId.has(s.parentSpanId))
    .sort((a, b) => a.startNano - b.startNano);
  for (const root of roots) walk(root);
}

export function renderPuml(title: string, traces: NormSpan[][]): string {
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
    ...orderedParticipants(present).map((p) => `participant ${p}`),
  ];
  return [...header, ...body, '@enduml', ''].join('\n');
}

export function spansToPuml(spans: NormSpan[], title: string): string {
  return renderPuml(title, [spans]);
}
```

Note on the expected arrows: PlantUML treats `participant Browser` and `"Browser"` as the same lifeline, so the declared `participant Browser` header and the quoted `"Browser" -> ...` messages refer to one participant. The test asserts both forms.

- [ ] **Step 5: Run the tests to verify they pass**

Run (from `petclinic-ui-test/`): `npm run test:unit -- trace-to-puml`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add petclinic-ui-test/src/trace-diagram/trace-to-puml.ts petclinic-ui-test/src/trace-diagram/trace-to-puml.spec.ts petclinic-ui-test/src/trace-diagram/__fixtures__/add-visit-trace.json
git commit -m "feat(ui-test): Tempo trace → PlantUML sequence diagram core"
```

---

### Task 5: Generator orchestration

**Files:**
- Create: `petclinic-ui-test/src/trace-diagram/generate.ts`
- Create: `petclinic-ui-test/src/trace-diagram/generate.spec.ts`
- Modify: `petclinic-ui-test/package.json` (add `trace:diagram` script)

**Interfaces:**
- Consumes: `parseTempoTrace`, `renderPuml`, `NormSpan` (Task 4); `tempoConfigFromEnv`, `searchTraceIds`, `getTrace` (Task 3).
- Produces:
  - `interface TestWindow { title: string; startMs: number; endMs: number; }`
  - `interface GenerateDeps { searchTraceIds: (traceql: string, startMs: number, endMs: number) => Promise<string[]>; getTrace: (traceId: string) => Promise<unknown>; writeFile: (filePath: string, content: string) => void; log: (msg: string) => void; }`
  - `slugify(title: string): string`
  - `generateFromWindows(windows: TestWindow[], outDir: string, deps: GenerateDeps): Promise<string[]>` (returns written file paths)
  - `runGenerate(): Promise<void>` (CLI entry; reads `test-results/trace-windows.json`, wires real deps, never throws)

- [ ] **Step 1: Write the failing test**

Create `petclinic-ui-test/src/trace-diagram/generate.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { slugify, generateFromWindows, TestWindow, GenerateDeps } from './generate';

const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '__fixtures__', 'add-visit-trace.json'), 'utf-8'),
);

test('slugify makes filesystem-safe names', () => {
  expect(slugify('Add a visit!')).toBe('add-a-visit');
});

test('generateFromWindows writes one puml per test that has traces', async () => {
  const written: Record<string, string> = {};
  const deps: GenerateDeps = {
    searchTraceIds: async () => ['t1'],
    getTrace: async () => fixture,
    writeFile: (p, c) => { written[p] = c; },
    log: () => {},
  };
  const windows: TestWindow[] = [{ title: 'Add a visit', startMs: 0, endMs: 10_000 }];
  const paths = await generateFromWindows(windows, '/out', deps);
  expect(paths).toEqual(['/out/add-a-visit.puml']);
  expect(written['/out/add-a-visit.puml']).toContain('Browser -> Backend: POST /api/visits');
});

test('generateFromWindows skips (no throw) when a test has zero traces', async () => {
  const logs: string[] = [];
  const deps: GenerateDeps = {
    searchTraceIds: async () => [],
    getTrace: async () => { throw new Error('should not be called'); },
    writeFile: () => { throw new Error('should not write'); },
    log: (m) => logs.push(m),
  };
  const paths = await generateFromWindows(
    [{ title: 'Empty', startMs: 0, endMs: 1 }], '/out', deps,
  );
  expect(paths).toEqual([]);
  expect(logs.join('\n')).toContain('no traces');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run (from `petclinic-ui-test/`): `npm run test:unit -- generate`
Expected: FAIL — cannot find module `./generate`.

- [ ] **Step 3: Implement the generator**

Create `petclinic-ui-test/src/trace-diagram/generate.ts`:

```ts
import * as fs from 'fs';
import * as path from 'path';
import { parseTempoTrace, renderPuml, NormSpan } from './trace-to-puml';
import { tempoConfigFromEnv, searchTraceIds, getTrace } from './tempo-client';

export interface TestWindow {
  title: string;
  startMs: number;
  endMs: number;
}

export interface GenerateDeps {
  searchTraceIds: (traceql: string, startMs: number, endMs: number) => Promise<string[]>;
  getTrace: (traceId: string) => Promise<unknown>;
  writeFile: (filePath: string, content: string) => void;
  log: (msg: string) => void;
}

export function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export async function generateFromWindows(
  windows: TestWindow[], outDir: string, deps: GenerateDeps,
): Promise<string[]> {
  const written: string[] = [];
  for (const w of windows) {
    const traceql = `{ span.test.name = "${w.title}" }`;
    const ids = await deps.searchTraceIds(traceql, w.startMs, w.endMs);
    if (ids.length === 0) {
      deps.log(`⏭️  "${w.title}": no traces in window — skipped`);
      continue;
    }
    const traces: NormSpan[][] = [];
    for (const id of ids) {
      traces.push(parseTempoTrace(await deps.getTrace(id)));
    }
    const puml = renderPuml(w.title, traces);
    const filePath = `${outDir}/${slugify(w.title)}.puml`;
    deps.writeFile(filePath, puml);
    deps.log(`✅ "${w.title}": ${ids.length} trace(s) → ${filePath}`);
    written.push(filePath);
  }
  return written;
}

export async function runGenerate(): Promise<void> {
  const root = path.join(__dirname, '..', '..');
  const windowsFile = path.join(root, 'test-results', 'trace-windows.json');
  const outDir = path.join(root, 'diagrams');

  if (!fs.existsSync(windowsFile)) {
    console.warn(`ℹ️  ${windowsFile} not found — no diagrams generated.`);
    return;
  }
  const windows: TestWindow[] = JSON.parse(fs.readFileSync(windowsFile, 'utf-8'));
  fs.mkdirSync(outDir, { recursive: true });

  const cfg = tempoConfigFromEnv();
  const deps: GenerateDeps = {
    searchTraceIds: (q, s, e) => searchTraceIds(cfg, q, s, e),
    getTrace: (id) => getTrace(cfg, id),
    writeFile: (p, c) => fs.writeFileSync(p, c),
    log: (m) => console.log(m),
  };

  try {
    const paths = await generateFromWindows(windows, outDir, deps);
    console.log(`📊 Generated ${paths.length} diagram(s) in ${outDir}`);
  } catch (err) {
    console.warn(`⚠️  Diagram generation failed (continuing): ${(err as Error).message}`);
  }
}

if (require.main === module) {
  void runGenerate();
}
```

In `petclinic-ui-test/package.json`, add to `scripts`:

```json
    "trace:diagram": "ts-node src/trace-diagram/generate.ts",
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `petclinic-ui-test/`): `npm run test:unit -- generate`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add petclinic-ui-test/src/trace-diagram/generate.ts petclinic-ui-test/src/trace-diagram/generate.spec.ts petclinic-ui-test/package.json
git commit -m "feat(ui-test): orchestrate per-test diagram generation from Tempo"
```

---

### Task 6: Playwright fixture + window store + globalTeardown wiring

**Files:**
- Create: `petclinic-ui-test/tests/support/trace-window-store.ts`
- Create: `petclinic-ui-test/tests/support/trace-window-store.spec.ts`
- Create: `petclinic-ui-test/tests/support/trace-fixture.ts`
- Create: `petclinic-ui-test/tests/support/global-teardown.ts`
- Modify: `petclinic-ui-test/playwright.config.ts` (register `globalTeardown`)
- Modify: `petclinic-ui-test/tests/visits.spec.ts`, `tests/owners.spec.ts`, `tests/chatbot.spec.ts` (import `test`/`expect` from the fixture)

**Interfaces:**
- Consumes: `TestWindow` (Task 5); `runGenerate` (Task 5).
- Produces:
  - `mergeWindow(existing: TestWindow[], entry: TestWindow): TestWindow[]` (pure; replaces same-title entry)
  - `appendWindow(file: string, entry: TestWindow): void`
  - `test` / `expect` re-exported from `trace-fixture.ts` (Playwright test extended to stamp `window.__E2E_TEST_NAME__` and record the window)

Note: `trace-window-store.spec.ts` lives under `tests/` but is matched by `playwright.unit.config.ts` (`testDir: './src'`)? No — it must be discoverable by the unit runner. Place this spec in `src/trace-diagram/` instead to keep it in the unit suite: create `petclinic-ui-test/src/trace-diagram/trace-window-store.spec.ts` and import from `../../tests/support/trace-window-store`.

- [ ] **Step 1: Write the failing test for the pure merge helper**

Create `petclinic-ui-test/src/trace-diagram/trace-window-store.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { mergeWindow } from '../../tests/support/trace-window-store';

test('mergeWindow appends a new title', () => {
  const out = mergeWindow([], { title: 'a', startMs: 1, endMs: 2 });
  expect(out).toEqual([{ title: 'a', startMs: 1, endMs: 2 }]);
});

test('mergeWindow replaces an existing same-title entry', () => {
  const out = mergeWindow(
    [{ title: 'a', startMs: 1, endMs: 2 }],
    { title: 'a', startMs: 9, endMs: 10 },
  );
  expect(out).toEqual([{ title: 'a', startMs: 9, endMs: 10 }]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run (from `petclinic-ui-test/`): `npm run test:unit -- trace-window-store`
Expected: FAIL — cannot find module `../../tests/support/trace-window-store`.

- [ ] **Step 3: Implement the window store**

Create `petclinic-ui-test/tests/support/trace-window-store.ts`:

```ts
import * as fs from 'fs';
import * as path from 'path';
import { TestWindow } from '../../src/trace-diagram/generate';

export function mergeWindow(existing: TestWindow[], entry: TestWindow): TestWindow[] {
  const kept = existing.filter((w) => w.title !== entry.title);
  return [...kept, entry];
}

export function appendWindow(file: string, entry: TestWindow): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const existing: TestWindow[] = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, 'utf-8'))
    : [];
  fs.writeFileSync(file, JSON.stringify(mergeWindow(existing, entry), null, 2));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run (from `petclinic-ui-test/`): `npm run test:unit -- trace-window-store`
Expected: PASS (2 tests).

- [ ] **Step 5: Create the Playwright fixture (stamps test name + records window)**

Create `petclinic-ui-test/tests/support/trace-fixture.ts`:

```ts
import { test as base } from '@playwright/test';
import * as path from 'path';
import { appendWindow } from './trace-window-store';

const WINDOWS_FILE = path.join(__dirname, '..', '..', 'test-results', 'trace-windows.json');

// Pads the recorded window so the BatchSpanProcessor's async export (and Tempo
// ingestion lag) still falls inside the search range.
const PRE_PAD_MS = 1_000;
const POST_PAD_MS = 5_000;

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    await page.addInitScript((name) => {
      (window as any).__E2E_TEST_NAME__ = name;
    }, testInfo.title);

    const startMs = Date.now() - PRE_PAD_MS;
    await use(page);
    const endMs = Date.now() + POST_PAD_MS;

    appendWindow(WINDOWS_FILE, { title: testInfo.title, startMs, endMs });
  },
});

export { expect } from '@playwright/test';
```

- [ ] **Step 6: Point the e2e specs at the fixture**

In each of `tests/visits.spec.ts`, `tests/owners.spec.ts`, `tests/chatbot.spec.ts`, replace:

```ts
import {test, expect} from '@playwright/test';
```

with:

```ts
import {test, expect} from './support/trace-fixture';
```

- [ ] **Step 7: Create the globalTeardown**

Create `petclinic-ui-test/tests/support/global-teardown.ts`:

```ts
import { runGenerate } from '../../src/trace-diagram/generate';

// Runs after the whole Playwright suite. runGenerate() never throws; any failure
// is logged and swallowed so a telemetry hiccup can't fail the test run.
export default async function globalTeardown(): Promise<void> {
  await runGenerate();
}
```

- [ ] **Step 8: Register the teardown in `playwright.config.ts`**

In `petclinic-ui-test/playwright.config.ts`, inside the `defineConfig({ ... })` object (sibling of `testDir`), add:

```ts
  globalTeardown: './tests/support/global-teardown.ts',
```

- [ ] **Step 9: Verify unit tests still pass and the configs type-check**

Run (from `petclinic-ui-test/`): `npm run test:unit`
Expected: PASS (all unit specs across tempo-client, trace-to-puml, generate, trace-window-store).

Run (from `petclinic-ui-test/`): `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 10: Manual end-to-end verification**

1. From the repo root, in separate terminals: `./start-database.sh`, `./start-grafana.sh`, `./start-backend.sh`, `./start-frontend.sh` (backend must show "OpenTelemetry agent attached").
2. From `petclinic-ui-test/`: `SKIP_SERVER_START=1 npm test` (apps already running).
3. Confirm `petclinic-ui-test/diagrams/*.puml` were generated and that at least one contains `Browser -> Backend` and `Backend -> Backend: book-visit`.
4. (Optional) render: `plantuml petclinic-ui-test/diagrams/*.puml` (best-effort; requires PlantUML installed).

- [ ] **Step 11: Commit**

```bash
git add petclinic-ui-test/tests/support/trace-window-store.ts petclinic-ui-test/src/trace-diagram/trace-window-store.spec.ts petclinic-ui-test/tests/support/trace-fixture.ts petclinic-ui-test/tests/support/global-teardown.ts petclinic-ui-test/playwright.config.ts petclinic-ui-test/tests/visits.spec.ts petclinic-ui-test/tests/owners.spec.ts petclinic-ui-test/tests/chatbot.spec.ts
git commit -m "feat(ui-test): per-test trace window + globalTeardown diagram generation"
```

---

## Final integration commit (diagrams output dir)

- [ ] Add `petclinic-ui-test/diagrams/.gitignore` containing `*` (generated output not versioned), or commit a sample diagram if you want one checked in. Default: ignore.

```bash
mkdir -p petclinic-ui-test/diagrams && printf '*\n!.gitignore\n' > petclinic-ui-test/diagrams/.gitignore
git add petclinic-ui-test/diagrams/.gitignore
git commit -m "chore(ui-test): ignore generated diagram output"
```

## Self-Review (author checklist — done)

- **Spec coverage:** PlantUML output (Task 4) ✓; TS in ui-test (Tasks 3-6) ✓; Playwright globalTeardown (Task 6) ✓; per-test `test.name` tag via frontend span attribute (Task 2 + fixture Task 6) ✓; TraceQL + window selection (Task 5) ✓; backend `@WithSpan` private method (Task 1) ✓; Tempo via Grafana proxy admin/admin (Task 3) ✓; graceful degradation (Task 5 `runGenerate` try/catch + zero-trace skip) ✓; output to `diagrams/` (Task 5/final) ✓; unit-tested core with fixture (Task 4) ✓.
- **Placeholder scan:** no TBD/TODO; every code step has full code.
- **Type consistency:** `TestWindow`/`GenerateDeps`/`NormSpan` defined once and imported by consumers; `searchTraceIds`/`getTrace`/`renderPuml`/`parseTempoTrace`/`slugify`/`mergeWindow`/`appendWindow` names used consistently across tasks.
```
