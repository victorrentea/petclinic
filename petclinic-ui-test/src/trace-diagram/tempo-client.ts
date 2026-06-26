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
