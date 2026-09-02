import {test, expect} from '@playwright/test';
import {parseTempoTrace} from './trace-to-puml';
import {DETAIL_INDEX_VERSION} from './detail-index';
import * as fs from 'fs';
import * as path from 'path';
import {CachedSource, GenerateDeps, TestWindow, detailsPathFor, diagramPathFor, generateFromWindows, mergeCachedSources, renderScenarios, slugify, spanCachePathFor} from './generate';

const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '__fixtures__', 'add-visit-trace.json'), 'utf-8'),
);

test('slugify makes filesystem-safe names', () => {
  expect(slugify('Add a visit!')).toBe('add-a-visit');
});

test('the diagram is filed next to its test, named after it', () => {
  expect(diagramPathFor('/root', 'src/owner-search.feature'))
    .toBe('/root/src/owner-search.feature.genseq.puml');
  expect(diagramPathFor('/root', 'src/add-visit.spec.ts'))
    .toBe('/root/src/add-visit.spec.ts.genseq.puml');
});

// One file per source, however many tagged scenarios it holds — they become
// sections of the same diagram rather than files scattered by scenario name.
test('what the markers reveal is filed beside the diagram, and is not itself a diagram', async () => {
  const written: Record<string, string> = {};
  renderScenarios(
    [{source: 'src/add-visit.spec.ts',
      scenarios: [{title: 'Add a visit', traces: [parseTempoTrace(fixture)]}]}],
    '/out', {writeFile: (p, c) => { written[p] = c; }, log: () => {}},
    {sql: 'statement', httpBodies: true, interactive: true},
  );

  expect(detailsPathFor('/out', 'src/add-visit.spec.ts'))
    .toBe('/out/src/add-visit.spec.ts.genseq.json');
  const index = JSON.parse(written['/out/src/add-visit.spec.ts.genseq.json']);
  expect(index.version).toBe(DETAIL_INDEX_VERSION);
  // every id in the index is addressed by a marker in the picture beside it
  for (const id of Object.keys(index.details)) {
    expect(written['/out/src/add-visit.spec.ts.genseq.puml']).toContain(`[[genseq://${id}{`);
  }
});

// A static diagram has nothing left to reveal, so it must not leave a sidecar behind
// claiming otherwise.
test('the static path writes the picture alone, and drops a sidecar left by an earlier level', () => {
  const written: Record<string, string> = {};
  const removed: string[] = [];
  renderScenarios(
    [{source: 'src/add-visit.spec.ts',
      scenarios: [{title: 'Add a visit', traces: [parseTempoTrace(fixture)]}]}],
    '/out',
    {writeFile: (p, c) => { written[p] = c; }, removeFile: (p) => removed.push(p), log: () => {}},
    {sql: 'values', httpBodies: true, interactive: false},
  );
  expect(Object.keys(written)).toEqual(['/out/src/add-visit.spec.ts.genseq.puml']);
  expect(removed).toEqual(['/out/src/add-visit.spec.ts.genseq.json']);
});

test('generateFromWindows writes one puml per source file, sectioned by scenario', async () => {
  const written: Record<string, string> = {};
  const deps: GenerateDeps = {
    searchTraceIds: async () => ['t1'],
    getTrace: async () => fixture,
    writeFile: (p, c) => { written[p] = c; },
    log: () => {},
  };
  const windows: TestWindow[] = [
    { title: 'Add a visit', source: 'src/add-visit.spec.ts', startMs: 0, endMs: 10_000 },
    { title: 'Cancel a visit', source: 'src/add-visit.spec.ts', startMs: 0, endMs: 10_000 },
    { title: 'Search owners', source: 'src/owner-search.feature', startMs: 0, endMs: 10_000 },
  ];
  const paths = await generateFromWindows(windows, '/out', deps);

  expect(paths).toEqual([
    '/out/src/add-visit.spec.ts.genseq.puml',
    '/out/src/owner-search.feature.genseq.puml',
  ]);
  const addVisit = written['/out/src/add-visit.spec.ts.genseq.puml'];
  expect(addVisit).toContain('== Add a visit ==');
  expect(addVisit).toContain('== Cancel a visit ==');
  // the arrow is wrapped in its reveal link now, so match the label inside it
  expect(addVisit).toContain('addVisit\\nPOST /api/visits');
  expect(addVisit).toContain("' ⚠️  GENERATED FILE — DO NOT EDIT");
});

// A sequence diagram is evidence only if the reviewer can reach the test that produced
// it, and the section header is the only place in the picture that names that test.
test('each section header links to the test that drew it', () => {
  const written: Record<string, string> = {};
  renderScenarios(
    [{source: 'src/add-visit.spec.ts',
      scenarios: [{title: 'Add a visit', traces: [parseTempoTrace(fixture)]}]}],
    '/out/petclinic-test',
    {
      writeFile: (p, c) => { written[p] = c; },
      readFile: () => "test('Add a visit', async () => {});",
      log: () => {},
    },
  );
  expect(written['/out/petclinic-test/src/add-visit.spec.ts.genseq.puml']).toContain(
    '== [[src://petclinic-test/src/add-visit.spec.ts:1{Click to open the test} Add a visit]] ==');
});

// Nothing to read the source with means nothing to point at: a header that links into a
// file nobody could confirm exists is worse than a header that stays plain.
test('a header stays plain when the test source cannot be read', () => {
  const written: Record<string, string> = {};
  renderScenarios(
    [{source: 'src/add-visit.spec.ts',
      scenarios: [{title: 'Add a visit', traces: [parseTempoTrace(fixture)]}]}],
    '/out', {writeFile: (p, c) => { written[p] = c; }, log: () => {}},
  );
  expect(written['/out/src/add-visit.spec.ts.genseq.puml']).toContain('== Add a visit ==');
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
    [{ title: 'Empty', source: 'src/x.spec.ts', startMs: 0, endMs: 1 }], '/out', deps, { attempts: 1 },
  );
  expect(paths).toEqual([]);
  expect(logs.join('\n')).toContain('no traces');
});

// Tempo ingests asynchronously: a search fired the instant the suite ends
// routinely returns nothing for traces that show up a second or two later.
test('generateFromWindows retries a window until Tempo has ingested it', async () => {
  const slept: number[] = [];
  let searches = 0;
  const deps: GenerateDeps = {
    searchTraceIds: async () => (++searches < 3 ? [] : ['t1']),
    getTrace: async () => fixture,
    writeFile: () => {},
    log: () => {},
    sleep: async (ms) => { slept.push(ms); },
  };
  const paths = await generateFromWindows(
    [{ title: 'Add a visit', source: 'src/add-visit.spec.ts', startMs: 0, endMs: 1 }], '/out', deps,
    { attempts: 5, delayMs: 250 },
  );
  expect(searches).toBe(3);
  expect(slept).toEqual([250, 250]);
  expect(paths).toEqual(['/out/src/add-visit.spec.ts.genseq.puml']);
});

test('generateFromWindows gives up after the configured number of attempts', async () => {
  let searches = 0;
  const deps: GenerateDeps = {
    searchTraceIds: async () => { searches++; return []; },
    getTrace: async () => { throw new Error('should not be called'); },
    writeFile: () => { throw new Error('should not write'); },
    log: () => {},
    sleep: async () => {},
  };
  const paths = await generateFromWindows(
    [{ title: 'Empty', source: 'src/x.spec.ts', startMs: 0, endMs: 1 }], '/out', deps, { attempts: 4, delayMs: 1 },
  );
  expect(searches).toBe(4);
  expect(paths).toEqual([]);
});

// A scenario is several traces and the diagram's whole claim is that it shows the
// order they happened in — Tempo hands them back newest-first.
const tempoTrace = (spans: {name: string; service: string; startNano: number; kind: string}[]) => ({
  batches: spans.map((s, i) => ({
    resource: {attributes: [{key: 'service.name', value: {stringValue: s.service}}]},
    scopeSpans: [{spans: [{
      traceId: 't', spanId: `s${i}`, parentSpanId: i === 0 ? '' : 's0',
      name: s.name, kind: s.kind, startTimeUnixNano: String(s.startNano), attributes: [],
    }]}],
  })),
});

test('traces are ordered by the server clock, not by the browser root span', async () => {
  // The browser root of the POST opens *before* the request — it is the click that
  // navigated — so ordering by "earliest span of any kind" would put the POST first.
  const post = tempoTrace([
    {name: 'click', service: 'petclinic-frontend', kind: 'SPAN_KIND_INTERNAL', startNano: 1_000},
    {name: 'POST /api/visits', service: 'petclinic-backend', kind: 'SPAN_KIND_SERVER', startNano: 3_000},
  ]);
  const get = tempoTrace([
    {name: 'click', service: 'petclinic-frontend', kind: 'SPAN_KIND_INTERNAL', startNano: 1_500},
    {name: 'GET /api/pets', service: 'petclinic-backend', kind: 'SPAN_KIND_SERVER', startNano: 2_000},
  ]);

  const written: Record<string, string> = {};
  await generateFromWindows(
    [{title: 'Add a visit', source: 'src/add-visit.spec.ts', startMs: 1, endMs: 2}],
    '/out',
    {
      searchTraceIds: async () => ['post', 'get'],
      getTrace: async (id) => (id === 'post' ? post : get),
      writeFile: (p, c) => {
        written[p] = c;
      },
      log: () => {},
    },
  );

  const puml = written['/out/src/add-visit.spec.ts.genseq.puml'];
  expect(puml.indexOf('GET /api/pets')).toBeLessThan(puml.indexOf('POST /api/visits'));
});

// The whole point of the cache: after one Tempo fetch, changing the detail level is
// an offline, sub-second switch — no Grafana, no backend, no re-run of the suite.
test('generateFromWindows caches the spans it fetched', async () => {
  const written: Record<string, string> = {};
  const deps: GenerateDeps = {
    searchTraceIds: async () => ['t1'],
    getTrace: async () => fixture,
    writeFile: (p, c) => { written[p] = c; },
    log: () => {},
  };
  await generateFromWindows(
    [{title: 'Add a visit', source: 'src/add-visit.spec.ts', startMs: 0, endMs: 10_000}], '/out', deps,
  );

  const cached: CachedSource[] = JSON.parse(written[spanCachePathFor('/out')]);
  expect(cached.map((c) => c.source)).toEqual(['src/add-visit.spec.ts']);
  expect(cached[0].scenarios[0].title).toBe('Add a visit');
  expect(cached[0].scenarios[0].traces[0].length).toBeGreaterThan(0);
});

test('renderScenarios redraws from the cache at another detail level, touching no Tempo', () => {
  const written: Record<string, string> = {};
  const cached: CachedSource[] = JSON.parse(JSON.stringify([{
    source: 'src/add-visit.spec.ts',
    scenarios: [{title: 'Add a visit', traces: [parseTempoTrace(fixture)]}],
  }]));

  renderScenarios(cached, '/out', {writeFile: (p, c) => { written[p] = c; }, log: () => {}},
    {sql: 'off', httpBodies: false, interactive: false});

  const puml = written['/out/src/add-visit.spec.ts.genseq.puml'];
  expect(puml).toContain('== Add a visit ==');
  expect(puml).not.toContain('SELECT');
});

// Each runner fetches only the sources it owns. Writing that over the cache left it
// holding whichever suite ran last, so a later `npm run diagram` re-rendered that
// suite's diagrams and quietly none of the others.
test('a run replaces its own sources in the span cache and keeps the rest', () => {
  const cached = [
    {source: 'src/add-visit.spec.ts', scenarios: [{title: 'old', traces: []}]},
    {source: 'src/owner-search.feature', scenarios: [{title: 'search', traces: []}]},
  ];
  const fresh = [{source: 'src/add-visit.spec.ts', scenarios: [{title: 'new', traces: []}]}];

  const merged = mergeCachedSources(cached as any, fresh as any);
  expect(merged.map((c) => c.source))
    .toEqual(['src/add-visit.spec.ts', 'src/owner-search.feature']);
  expect(merged[0].scenarios[0].title).toBe('new');   // this run's, not the stale one
  expect(merged[1].scenarios[0].title).toBe('search'); // the other suite survives
});

test('an empty cache merges to just what was fetched', () => {
  const fresh = [{source: 'a.feature', scenarios: []}];
  expect(mergeCachedSources([], fresh as any)).toEqual(fresh);
});
