import {test, expect} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import {NormSpan, parseTempoTrace, renderDiagram, renderPuml, spansToPuml} from './trace-to-puml';
import {DiagramOptions} from './options';

// The diagrams are interactive by default now, so every assertion about a *baked in*
// label has to say so — which is also the regression test that the static path, the
// one CI and the committed snapshots depend on, still renders exactly what it did.
const STATIC: DiagramOptions = {sql: 'statement', httpBodies: false, interactive: false};

const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '__fixtures__', 'add-visit-trace.json'), 'utf-8'),
);

// A baked-in DB arrow carries both grains: Hibernate's account of the statement on the
// first line, then the statement folded one clause per line — `\n` being PlantUML's
// line break inside a message.
const INSERT_ORIGIN = 'insert for victor.training.petclinic.domain.Visit';
const INSERT_LABEL = `${INSERT_ORIGIN}\\nINSERT INTO petclinic.visits `
  + '(description, pet_id, visit_date, id)\\nVALUES (?, ?, ?, ?)';

// The API's own name for the route, from openapi.yaml, sits above it.
const ADD_VISIT = 'addVisit\\nPOST /api/visits';

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
  const puml = spansToPuml(parseTempoTrace(fixture), 'add a visit', STATIC);
  expect(puml).toContain('@startuml');
  expect(puml).toContain('@enduml');
  expect(puml).toContain('participant Browser');
  expect(puml).toContain('participant Backend');
  expect(puml).toContain('participant DB');
  expect(puml).toContain(`Browser -> Backend: ${ADD_VISIT}`);
  expect(puml).toContain('Backend -> Backend: book-visit');
  expect(puml).toContain(`Backend -> DB: ${INSERT_LABEL}`);
  expect(puml).toContain('Backend --> Browser: 201');
  // activate/deactivate are balanced
  const acts = (puml.match(/^activate /gm) ?? []).length;
  const deacts = (puml.match(/^deactivate /gm) ?? []).length;
  expect(acts).toBe(deacts);
});

test('spansToPuml nests a self-span\'s DB call inside the self-span activation', () => {
  const puml = spansToPuml(parseTempoTrace(fixture), 'add a visit', STATIC);
  // book-visit (@WithSpan) opens its own activation; the INSERT it triggers
  // must be drawn inside that activation, then the activation closes.
  expect(puml).toContain(
    'Backend -> Backend: book-visit\n' +
    'activate Backend\n' +
    `Backend -> DB: ${INSERT_LABEL}\n` +
    'deactivate Backend\n',
  );
  // the DB call carries no meaningful return value, so no return arrow is drawn
  expect(puml).not.toContain('DB --> Backend: return');
});

// Every activation bar costs vertical space, and a bar around a call that
// reaches nobody encloses nothing — the diagram grows for no information.
test('a call that reaches nothing draws a bare arrow, no activation bar', () => {
  const puml = spansToPuml(parseTempoTrace(fixture), 'add a visit', STATIC);
  // the INSERT is a leaf: arrow in, nothing inside, no box on the DB lifeline
  expect(puml).not.toContain('activate DB');
  expect(puml).not.toContain('deactivate DB');
  // the spans that do enclose something keep theirs
  expect(puml).toContain('activate Backend');
});

test('spansToPuml footers the diagram with its provenance', () => {
  const puml = spansToPuml(parseTempoTrace(fixture), 'add a visit', STATIC);
  // a PlantUML footer renders at the very bottom — provenance, not diagram content
  expect(puml).toContain('footer @generate_sequence');
  // the title stays a clean single line, no subtitle, no note, no caption
  expect(puml).toContain('\ntitle add a visit\n');
  expect(puml).not.toContain('note across');
  expect(puml).not.toContain('caption');
});

// "SELECT petclinic.owners" is true of every query the repository fires; Hibernate's
// account and the statement are what tell the reader which one this arrow is.
test('a DB arrow carries the statement, not the generic span name', () => {
  const puml = spansToPuml(parseTempoTrace(fixture), 'add a visit', STATIC);
  expect(puml).not.toContain('Backend -> DB: INSERT petclinic.visits');
  expect(puml).toContain('VALUES (?, ?, ?, ?)');
});

// The origin comment is Hibernate talking about the statement, not part of it: it
// belongs on the label, never folded in among the clauses.
test('the origin comment labels the arrow and stays out of the folded SQL', () => {
  const puml = spansToPuml(parseTempoTrace(fixture), 'add a visit', STATIC);
  expect(puml).toContain(`Backend -> DB: ${INSERT_ORIGIN}\\nINSERT INTO`);
  expect(puml).not.toContain('/*');
});

const dbSpanWithoutStatement: NormSpan[] = [
  {
    traceId: 't3', spanId: 'd1', parentSpanId: '', name: 'POST /api/visits',
    kind: 'SERVER', serviceName: 'petclinic-backend', startNano: 1, attributes: {},
  },
  {
    traceId: 't3', spanId: 'd2', parentSpanId: 'd1', name: 'SELECT petclinic.owners',
    kind: 'CLIENT', serviceName: 'petclinic-backend', startNano: 2,
    attributes: {'db.system': 'postgresql'},
  },
];

test('a DB span with no statement attribute keeps its span name', () => {
  const puml = spansToPuml(dbSpanWithoutStatement, 'no statement', STATIC);
  expect(puml).toContain('Backend -> DB: SELECT petclinic.owners');
});

// The traces carry SQL, bound values and payloads all at once; these switches
// decide what reaches the page, so a different level of detail is a re-render.
test('SEQ_SQL=off falls back to the generic span name', () => {
  const puml = spansToPuml(parseTempoTrace(fixture), 'add a visit', {...STATIC, sql: 'off'});
  expect(puml).toContain('Backend -> DB: INSERT petclinic.visits');
  expect(puml).not.toContain('VALUES');
});

test('SEQ_SQL=values puts the bound parameters back into the statement', () => {
  const puml = spansToPuml(parseTempoTrace(fixture), 'add a visit', {...STATIC, sql: 'values'});
  expect(puml).toContain("VALUES ('annual checkup', 7, '2026-08-20', 42)");
  expect(puml).not.toContain('VALUES (?, ?, ?, ?)');
});

// The payloads are captured in the browser, so they sit on the frontend CLIENT
// span — one level above the backend SERVER span the arrow is drawn from.
test('SEQ_HTTP_BODIES draws the request and response payloads as notes', () => {
  const puml = spansToPuml(parseTempoTrace(fixture), 'add a visit', {...STATIC, httpBodies: true});
  expect(puml).toContain('note over Browser, Backend');
  expect(puml).toContain('"description": "annual checkup"');
  expect(puml).toContain('"id": 42');
  expect(puml).toContain('end note');
});

test('payloads stay off unless asked for', () => {
  const puml = spansToPuml(parseTempoTrace(fixture), 'add a visit', STATIC);
  expect(puml).not.toContain('note over');
});

test('the legend states the detail level and how to change it, visibly in the image', () => {
  const puml = spansToPuml(parseTempoTrace(fixture), 'add a visit', {...STATIC, sql: 'values', httpBodies: true});
  expect(puml).toContain('  Detail shown here: SQL shown, with values · HTTP bodies shown');
  expect(puml).toContain('npm run diagram:lean');
  expect(puml).toContain('SEQ_SQL=off|statement|values SEQ_HTTP_BODIES=0|1');
  expect(puml).toContain('legend right');
  expect(puml).toContain('end legend');
});

const lonelyClick: NormSpan[] = [{
  traceId: 't2', spanId: 'c1', parentSpanId: '', name: 'click',
  kind: 'INTERNAL', serviceName: 'petclinic-frontend', startNano: 1, attributes: {},
}];

// One diagram per source file, one section per scenario in it — a scenario's
// several traces (each browser interaction opens its own) run together inside
// its section, because the reader thinks in scenarios, not in traces.
test('renderPuml titles by source file and sections by scenario', () => {
  const puml = renderPuml('add-visit.spec.ts', [
    {title: 'Add a visit', traces: [parseTempoTrace(fixture)]},
    {title: 'Cancel a visit', traces: [parseTempoTrace(fixture)]},
  ]);

  expect(puml).toContain('\ntitle add-visit.spec.ts\n');
  expect(puml).toContain('== Add a visit ==');
  expect(puml).toContain('== Cancel a visit ==');
  // participants are declared once for the whole file, not per section
  expect(puml.match(/^participant Browser$/gm)).toHaveLength(1);
});

// The browser emits standalone spans (a lone `click`, say) that draw no arrow at
// all. Those traces must vanish inside their scenario, and a scenario left with
// nothing to draw must not leave an empty section behind.
test('renderPuml drops traces that would draw nothing', () => {
  const puml = renderPuml('add-visit.spec.ts', [
    {title: 'Add a visit', traces: [lonelyClick, parseTempoTrace(fixture)]},
    {title: 'Clicked around', traces: [lonelyClick]},
  ]);

  expect(puml).toContain('== Add a visit ==');
  expect(puml).not.toContain('== Clicked around ==');
  expect(puml).toContain(`Browser -> Backend: ${ADD_VISIT}`);
});

// ── progressive disclosure ────────────────────────────────────────────────────
// The default picture is the simplified one, and every arrow that has more to say
// carries a link marker whose id addresses that arrow's detail in the sidecar.

const MARKER = /\[\[genseq:\/\/([a-z0-9-]+)\{[^}]*\} [^\]]*\]\]/;

interface Step {label: string; text: string; alternate?: {label: string; text: string}}

const detailOn = (line: string, details: Record<string, {title: string; steps: Step[]}>) =>
  details[MARKER.exec(line)![1]];

const lineWith = (puml: string, needle: string) =>
  puml.split('\n').find((l) => l.includes(needle))!;

test('an interactive DB arrow is labelled with Hibernate\'s account, SQL behind the link', () => {
  const {puml, details} = renderDiagram('add-visit.spec.ts',
    [{title: 'Add a visit', traces: [parseTempoTrace(fixture)]}]);

  const arrow = lineWith(puml, 'Backend -> DB:');
  expect(arrow).toContain(INSERT_ORIGIN);
  expect(arrow).not.toContain('VALUES');
  expect(arrow).toMatch(MARKER);
  // the whole label is the click target — nothing trails the link
  expect(arrow.trimEnd().endsWith(']]')).toBe(true);

  // One step, not a cycle: the bound values are the step's alternate, which the panel
  // offers as a toggle.
  const entry = detailOn(arrow, details.details);
  expect(entry.steps).toHaveLength(1);
  expect(entry.steps[0].label).toBe('statement as sent — ? for each bound value');
  expect(entry.steps[0].text).toContain('VALUES (?, ?, ?, ?)');
  expect(entry.steps[0].alternate!.label).toBe('with the bound values put back');
  expect(entry.steps[0].alternate!.text).toContain("VALUES ('annual checkup', 7, '2026-08-20', 42)");
});

// A DB span the agent captured no parameters for has nothing to put back, so the panel
// must not offer a toggle onto the same text.
test('a statement with no bound parameters offers only the statement', () => {
  const spans = parseTempoTrace(fixture).map((s) => ({
    ...s,
    attributes: Object.fromEntries(
      Object.entries(s.attributes).filter(([k]) => !k.startsWith('db.query.parameter.'))),
  }));
  const {puml, details} = renderDiagram('x', [{title: 'x', traces: [spans]}]);
  const steps = detailOn(lineWith(puml, 'Backend -> DB:'), details.details).steps;
  expect(steps).toHaveLength(1);
  expect(steps[0].alternate).toBeUndefined();
});

test('the payloads become markers on the request and the response, not notes', () => {
  const {puml, details} = renderDiagram('add-visit.spec.ts',
    [{title: 'Add a visit', traces: [parseTempoTrace(fixture)]}],
    {sql: 'statement', httpBodies: true, interactive: true});

  expect(puml).not.toContain('note over');

  const request = detailOn(lineWith(puml, 'Browser -> Backend:'), details.details);
  expect(request.steps[0].label).toBe('request body');
  expect(request.steps[0].text).toContain('"description": "annual checkup"');

  const response = detailOn(lineWith(puml, 'Backend --> Browser:'), details.details);
  expect(response.steps[0].label).toBe('response body');
  expect(response.steps[0].text).toContain('"id": 42');
});

test('payloads stay unrevealable unless asked for, SQL off leaves no marker at all', () => {
  const plain = renderDiagram('x', [{title: 'x', traces: [parseTempoTrace(fixture)]}]);
  expect(lineWith(plain.puml, 'Browser -> Backend:')).not.toMatch(MARKER);

  const none = renderDiagram('x', [{title: 'x', traces: [parseTempoTrace(fixture)]}],
    {sql: 'off', httpBodies: false, interactive: true});
  expect(none.puml).not.toMatch(MARKER);
  expect(none.details.details).toEqual({});
});

// The review page renders a *textual* diff of the .puml, so an id that moved with
// its arrow's position would repaint every arrow below an inserted one as changed.
test('a marker id follows the arrow content, not its position in the file', () => {
  const one = renderDiagram('x', [{title: 'x', traces: [parseTempoTrace(fixture)]}]);
  const two = renderDiagram('x', [
    {title: 'earlier', traces: [parseTempoTrace(fixture)]},
    {title: 'x', traces: [parseTempoTrace(fixture)]},
  ]);
  expect(MARKER.exec(lineWith(two.puml, 'Backend -> DB:'))![1])
    .toBe(MARKER.exec(lineWith(one.puml, 'Backend -> DB:'))![1]);
});

test('an interactive diagram tones its link markup down and says how to use it', () => {
  const {puml} = renderDiagram('x', [{title: 'x', traces: [parseTempoTrace(fixture)]}],
    {sql: 'values', httpBodies: true, interactive: true});
  expect(puml).toContain('skinparam hyperlinkUnderline false');
  expect(puml).toContain("click a\n  highlighted arrow to reveal that one call's SQL / JSON payloads");
  expect(puml).toContain('  Detail shown here: simplified · click an arrow to reveal its SQL / JSON payloads');
});

// ── the Hibernate session spans ───────────────────────────────────────────────
// OTel draws a span for the session call behind every query. Under a Spring Data
// repository it restates the repository method in Hibernate's vocabulary and buys the
// diagram nothing but a lifeline hop; with no repository above it, it is the only
// account of what the code asked for.

const backendSpan = (
  spanId: string, parentSpanId: string, name: string, kind: NormSpan['kind'],
): NormSpan => ({
  traceId: 'h1', spanId, parentSpanId, name, kind,
  serviceName: 'petclinic-backend', startNano: Number(spanId.slice(1)), attributes: {},
});

const query = backendSpan('h4', 'h3', 'SELECT petclinic.owners', 'CLIENT');
query.attributes = {'db.system': 'postgresql'};

const viaRepository: NormSpan[] = [
  backendSpan('h1', '', 'GET /api/owners', 'SERVER'),
  backendSpan('h2', 'h1', 'OwnerRepository.findById', 'INTERNAL'),
  backendSpan('h3', 'h2', 'Session.find victor.training.petclinic.domain.Owner', 'INTERNAL'),
  query,
];

test('a session span under a repository is dropped, its query kept', () => {
  const puml = spansToPuml(viaRepository, 'via repository', STATIC);
  expect(puml).toContain('Backend -> Backend: OwnerRepository.findById');
  expect(puml).not.toContain('Session.find');
  expect(puml).toContain('Backend -> DB: SELECT petclinic.owners');
});

test('a session span with no repository above it is kept', () => {
  const direct = viaRepository.filter((s) => s.spanId !== 'h2')
    .map((s) => (s.spanId === 'h3' ? {...s, parentSpanId: 'h1'} : s));
  const puml = spansToPuml(direct, 'direct entity manager', STATIC);
  expect(puml).toContain('Backend -> Backend: Session.find victor.training.petclinic.domain.Owner');
});

// `Hibernate Query` is the same instrumentation saying the same redundant thing for a
// query rather than a lookup.
test('a Hibernate Query span under a repository is dropped too', () => {
  const spans = viaRepository.map(
    (s) => (s.spanId === 'h3' ? {...s, name: 'Hibernate Query'} : s));
  const puml = spansToPuml(spans, 'via repository', STATIC);
  expect(puml).not.toContain('Hibernate Query');
  expect(puml).toContain('Backend -> DB: SELECT petclinic.owners');
});

// Dropping an arrow must not drop the activation bar that balanced it.
test('collapsing a session span leaves activate/deactivate balanced', () => {
  const puml = spansToPuml(viaRepository, 'via repository', STATIC);
  expect((puml.match(/^activate /gm) ?? []).length)
    .toBe((puml.match(/^deactivate /gm) ?? []).length);
});
