import {test, expect} from '@playwright/test';
import {
  tempoConfigFromEnv, authHeader, buildSearchUrl, buildTraceUrl, searchTraceIds,
} from './tempo-client';

test('tempoConfigFromEnv falls back to localhost grafana admin', () => {
  const cfg = tempoConfigFromEnv({});
  expect(cfg.baseUrl).toBe('http://localhost:3300');
  expect(cfg.user).toBe('admin');
  expect(cfg.password).toBe('admin');
});

test('TEMPO_URL talks to Tempo itself: no Grafana proxy, no login', async () => {
  const cfg = tempoConfigFromEnv({TEMPO_URL: 'http://localhost:3200', GRAFANA_URL: 'http://localhost:3300'});
  expect(buildTraceUrl(cfg, 'abc123')).toBe('http://localhost:3200/api/traces/abc123');
  expect(buildSearchUrl(cfg, '{}', 1, 2, 3)).toMatch(/^http:\/\/localhost:3200\/api\/search\?/);
  const seen: any[] = [];
  const fakeFetch = async (_url: string, init: any) => {
    seen.push(init.headers);
    return {ok: true, json: async () => ({traces: []})};
  };
  await searchTraceIds(cfg, '{}', 0, 1, fakeFetch as any);
  expect(seen[0].Authorization).toBeUndefined();
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
  // URLSearchParams form-encodes the TraceQL value (spaces as '+'); assert it
  // round-trips back to the original rather than a specific encoding.
  expect(new URL(url).searchParams.get('q')).toBe('{ span.test.name = "x" }');
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
