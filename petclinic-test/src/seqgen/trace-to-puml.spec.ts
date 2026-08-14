import {test, expect} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import {NormSpan, parseTempoTrace, renderPuml, spansToPuml} from './trace-to-puml';

const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '__fixtures__', 'add-visit-trace.json'), 'utf-8'),
);

// A DB arrow is labelled with the statement the span carries, folded one clause
// per line — `\n` being PlantUML's line break inside a message.
const INSERT_LABEL =
  'INSERT INTO petclinic.visits (description, pet_id, visit_date, id)\\nVALUES (?, ?, ?, ?)';

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
  expect(puml).toContain(`Backend -> DB: ${INSERT_LABEL}`);
  expect(puml).toContain('Backend --> Browser: 201');
  // activate/deactivate are balanced
  const acts = (puml.match(/^activate /gm) ?? []).length;
  const deacts = (puml.match(/^deactivate /gm) ?? []).length;
  expect(acts).toBe(deacts);
});

test('spansToPuml nests a self-span\'s DB call inside the self-span activation', () => {
  const puml = spansToPuml(parseTempoTrace(fixture), 'add a visit');
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
  const puml = spansToPuml(parseTempoTrace(fixture), 'add a visit');
  // the INSERT is a leaf: arrow in, nothing inside, no box on the DB lifeline
  expect(puml).not.toContain('activate DB');
  expect(puml).not.toContain('deactivate DB');
  // the spans that do enclose something keep theirs
  expect(puml).toContain('activate Backend');
});

test('spansToPuml footers the diagram with its provenance', () => {
  const puml = spansToPuml(parseTempoTrace(fixture), 'add a visit');
  // a PlantUML footer renders at the very bottom — provenance, not diagram content
  expect(puml).toContain('footer @generate_sequence');
  // the title stays a clean single line, no subtitle, no note, no caption
  expect(puml).toContain('\ntitle add a visit\n');
  expect(puml).not.toContain('note across');
  expect(puml).not.toContain('caption');
});

// "SELECT petclinic.owners" is true of every query the repository fires; the
// statement is what tells the reader which one this arrow is.
test('a DB arrow carries the statement, not the generic span name', () => {
  const puml = spansToPuml(parseTempoTrace(fixture), 'add a visit');
  expect(puml).not.toContain('Backend -> DB: INSERT petclinic.visits');
  expect(puml).toContain('VALUES (?, ?, ?, ?)');
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
  const puml = spansToPuml(dbSpanWithoutStatement, 'no statement');
  expect(puml).toContain('Backend -> DB: SELECT petclinic.owners');
});

// The traces carry SQL, bound values and payloads all at once; these switches
// decide what reaches the page, so a different level of detail is a re-render.
test('SEQ_SQL=off falls back to the generic span name', () => {
  const puml = spansToPuml(parseTempoTrace(fixture), 'add a visit', {sql: 'off', httpBodies: false});
  expect(puml).toContain('Backend -> DB: INSERT petclinic.visits');
  expect(puml).not.toContain('VALUES');
});

test('SEQ_SQL=values puts the bound parameters back into the statement', () => {
  const puml = spansToPuml(parseTempoTrace(fixture), 'add a visit', {sql: 'values', httpBodies: false});
  expect(puml).toContain('VALUES (annual checkup, 7, 2026-08-20, 42)');
  expect(puml).not.toContain('VALUES (?, ?, ?, ?)');
});

// The payloads are captured in the browser, so they sit on the frontend CLIENT
// span — one level above the backend SERVER span the arrow is drawn from.
test('SEQ_HTTP_BODIES draws the request and response payloads as notes', () => {
  const puml = spansToPuml(parseTempoTrace(fixture), 'add a visit', {sql: 'statement', httpBodies: true});
  expect(puml).toContain('note over Browser, Backend');
  expect(puml).toContain('"description": "annual checkup"');
  expect(puml).toContain('"id": 42');
  expect(puml).toContain('end note');
});

test('payloads stay off unless asked for', () => {
  const puml = spansToPuml(parseTempoTrace(fixture), 'add a visit');
  expect(puml).not.toContain('note over');
});

test('the header states the detail level and how to change it', () => {
  const puml = spansToPuml(parseTempoTrace(fixture), 'add a visit', {sql: 'values', httpBodies: true});
  expect(puml).toContain("' Detail shown here: SQL shown, with values · HTTP bodies shown");
  expect(puml).toContain('npm run diagram:lean');
  expect(puml).toContain('SEQ_SQL=off|statement|values SEQ_HTTP_BODIES=0|1');
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
  expect(puml).toContain('Browser -> Backend: POST /api/visits');
});
