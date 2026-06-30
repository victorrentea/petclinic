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

test('spansToPuml captions the diagram (at the bottom) with which test generated it', () => {
  const puml = spansToPuml(parseTempoTrace(fixture), 'add a visit');
  // a PlantUML caption renders centered at the bottom — like the DB diagram
  expect(puml).toContain('caption generated from test "add a visit"');
  // the title stays a clean single line, no subtitle, no note
  expect(puml).toContain('\ntitle add a visit\n');
  expect(puml).not.toContain('note across');
});
