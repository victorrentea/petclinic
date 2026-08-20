import {test, expect} from '@playwright/test';
import * as fs from 'fs';
import {DEFAULT_SPEC, defaultOperations, operationNameOf, parseOperations} from './openapi-operations';

const SPEC = `openapi: 3.0.1
info:
  title: x
paths:
  /api/visits:
    get:
      operationId: listVisits
    post:
      operationId: addVisit
  /api/owners:
    get:
      operationId: listOwners
      summary: List owners
components:
  schemas:
    Visit:
      get:
        operationId: notAnOperation
`;

test('reads one name per verb per route', () => {
  const ops = parseOperations(SPEC);
  expect(ops.get('GET /api/visits')).toBe('listVisits');
  expect(ops.get('POST /api/visits')).toBe('addVisit');
});

// `summary` is prose someone wrote for a human, which is what an arrow label is;
// operationId is the fallback that keeps the lookup total rather than patchy.
test('a summary wins over the operationId beside it', () => {
  expect(parseOperations(SPEC).get('GET /api/owners')).toBe('List owners');
});

// `components:` is full of things shaped exactly like operations — a schema named
// `get`, a property named `post`. Only what is under `paths:` is an operation.
test('nothing outside the paths block is read as an operation', () => {
  const names = [...parseOperations(SPEC).values()];
  expect(names).not.toContain('notAnOperation');
});

test('a span name that is not a route has no operation', () => {
  const ops = parseOperations(SPEC);
  expect(operationNameOf('Hibernate Query', ops)).toBeUndefined();
  expect(operationNameOf('SELECT petclinic.owners', ops)).toBeUndefined();
  expect(operationNameOf('POST /api/visits', ops)).toBe('addVisit');
});

// The whole point is naming *this* project's calls, so the real contract has to be
// where the module looks and has to parse — a silently empty map would just mean
// every arrow quietly keeps its bare route.
test('the repo\'s own openapi.yaml is found and parsed', () => {
  expect(fs.existsSync(DEFAULT_SPEC)).toBe(true);
  const ops = defaultOperations();
  expect(ops.size).toBeGreaterThan(20);
  expect(operationNameOf('POST /api/visits', ops)).toBe('addVisit');
});
