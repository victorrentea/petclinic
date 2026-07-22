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

test('spansToPuml nests a self-span\'s DB call inside the self-span activation', () => {
  const puml = spansToPuml(parseTempoTrace(fixture), 'add a visit');
  // book-visit (@WithSpan) opens its own activation; the INSERT it triggers
  // must be drawn inside that activation, then the activation closes.
  expect(puml).toContain(
    'Backend -> Backend: book-visit\n' +
    'activate Backend\n' +
    'Backend -> DB: INSERT petclinic.visits\n' +
    'activate DB\n' +
    'deactivate DB\n' +
    'deactivate Backend\n',
  );
  // the DB call carries no meaningful return value, so no return arrow is drawn
  expect(puml).not.toContain('DB --> Backend: return');
});

test('spansToPuml footers the diagram with its provenance', () => {
  const puml = spansToPuml(parseTempoTrace(fixture), 'add a visit');
  // a PlantUML footer renders at the very bottom — provenance, not diagram content
  expect(puml).toContain('footer @generate_sequence Scenario in a .feature test');
  // the title stays a clean single line, no subtitle, no note, no caption
  expect(puml).toContain('\ntitle add a visit\n');
  expect(puml).not.toContain('note across');
  expect(puml).not.toContain('caption');
});
