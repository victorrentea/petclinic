import {expect, test} from '@playwright/test';
import type {NormSpan} from './trace-to-puml';
import {recordedRequest, requestMessage} from './http-request';

// The request an HTTP arrow's panel shows and the review page replays: the URL that was
// really sent, with its ids, never the route the server matched it to.

const span = (kind: string, name: string, attributes: Record<string, string>): NormSpan => ({
  traceId: 't', spanId: kind, parentSpanId: '', name, kind, serviceName: 'petclinic-backend',
  startNano: 0, attributes,
});
const server = (attributes: Record<string, string> = {}) =>
  span('SERVER', 'GET /api/owners/{ownerId}', attributes);

test('the URL is the one the client sent, with its ids', () => {
  const browser = span('CLIENT', 'GET', {'http.method': 'GET', 'http.url': 'http://127.0.0.1:8080/api/owners/1'});
  expect(recordedRequest(server(), browser, undefined))
    .toEqual({method: 'GET', url: 'http://127.0.0.1:8080/api/owners/1'});
  const java = span('CLIENT', 'POST', {'http.request.method': 'POST',
    'url.full': 'http://notification:8090/api/notifications/visit-booked'});
  expect(recordedRequest(server(), java, undefined).url)
    .toBe('http://notification:8090/api/notifications/visit-booked');
});

test('with no client to ask, the URL is put back together from the server’s account', () => {
  const received = server({'url.scheme': 'http', 'server.address': 'notification', 'server.port': '8090',
    'url.path': '/api/owners/1', 'url.query': 'x=1'});
  expect(recordedRequest(received, undefined, undefined).url).toBe('http://notification:8090/api/owners/1?x=1');
  // A parent that did not send it (a test's own span) is no client either.
  expect(recordedRequest(received, span('INTERNAL', 'when', {'http.url': 'http://wrong'}), undefined).url)
    .toBe('http://notification:8090/api/owners/1?x=1');
});

// An address made up here would send a replay somewhere nobody listens.
test('a server that does not say where it was reached gives the path alone', () => {
  expect(recordedRequest(server({'url.path': '/api/owners/1'}), undefined, undefined).url).toBe('/api/owners/1');
  expect(recordedRequest(server({'http.target': '/api/owners?lastName=P'}), undefined, undefined).url)
    .toBe('/api/owners?lastName=P');
  expect(recordedRequest(server(), undefined, undefined).url).toBe('/api/owners/{ownerId}');
});

test('the method comes from the attributes, else from a span name', () => {
  expect(recordedRequest(server({'http.request.method': 'put'}), undefined, undefined).method).toBe('PUT');
  expect(recordedRequest(span('SERVER', 'DELETE /api/pets/{id}', {}), undefined, undefined).method)
    .toBe('DELETE');
});

test('the headers come from the client span, and a broken record is no headers', () => {
  const sent = (headers: string) => span('CLIENT', 'GET', {'genseq.request-headers': headers});
  expect(recordedRequest(server(), sent('{"Accept":"application/json"}'), undefined).headers)
    .toEqual({Accept: 'application/json'});
  expect(recordedRequest(server(), sent('not json'), undefined)).not.toHaveProperty('headers');
  expect(recordedRequest(server(), sent('{}'), undefined)).not.toHaveProperty('headers');
  expect(recordedRequest(server(), sent('["a"]'), undefined)).not.toHaveProperty('headers');
});

test('the body is kept raw, and an empty one is no body', () => {
  expect(recordedRequest(server(), undefined, '{"a": 1}').body).toBe('{"a": 1}');
  expect(recordedRequest(server(), undefined, '  ')).not.toHaveProperty('body');
});

test('the message is a request line, a line per header, a blank line and the body', () => {
  expect(requestMessage({method: 'POST', url: 'http://h/api/visits',
    headers: {'Content-Type': 'application/json', Accept: '*/*'}, body: '{"a":1}'}))
    .toBe('POST http://h/api/visits\nContent-Type: application/json\nAccept: */*\n\n{\n  "a": 1\n}');
  expect(requestMessage({method: 'GET', url: 'http://h/api/owners/1'})).toBe('GET http://h/api/owners/1');
});
