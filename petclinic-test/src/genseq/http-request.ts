import type {NormSpan} from './trace-to-puml';
import type {HttpRequest} from './detail-index';
import {REQUEST_HEADERS_ATTRIBUTE} from './call-site';
import {formatJsonDetail} from './json-label';

/**
 * An HTTP arrow's request, as it went over the wire: what its detail panel shows, and what
 * the review page's "Open in Bruno" sends again (Victor, 10 Nov 2026).
 *
 * The arrow is drawn from the SERVER span, which knows the route the request matched
 * (`/api/owners/{ownerId}`) — a template, which no client can send. The span that *sent* it
 * knows the URL with the real ids in it, so that comes first: the browser's CLIENT span
 * records `http.url`, a Java client's `url.full`. Without a CLIENT parent (a service a test
 * called straight), the URL is put back together from what the server says it received.
 */

const VERB = /^([A-Z]+)\b/;

function clientOf(parent: NormSpan | undefined): NormSpan | undefined {
  return parent?.kind === 'CLIENT' ? parent : undefined;
}

function methodOf(server: NormSpan, client: NormSpan | undefined): string {
  for (const span of [client, server]) {
    const method = span?.attributes['http.method'] ?? span?.attributes['http.request.method'];
    if (method) return method.toUpperCase();
  }
  return VERB.exec(server.name.trim())?.[1] ?? VERB.exec(client?.name.trim() ?? '')?.[1] ?? 'GET';
}

/**
 * `http://127.0.0.1:8080/api/owners/1?x=y`, from the server's own account of the request.
 * A server that does not say which host it was reached at (a test's in-process call) gives
 * the path alone: an address made up here would send a replay somewhere nobody listens.
 */
function urlFromServer(server: NormSpan): string {
  const a = server.attributes;
  const target = a['http.target'];
  const path = a['url.path'] ?? target?.split('?')[0] ?? server.name.trim().split(/\s+/)[1] ?? '/';
  const query = a['url.query'] ?? (target?.includes('?') ? target.slice(target.indexOf('?') + 1) : undefined);
  const local = `${path}${query ? `?${query}` : ''}`;
  const host = a['server.address'] ?? a['net.host.name'];
  if (!host) return local;
  const port = a['server.port'] ?? a['net.host.port'];
  return `${a['url.scheme'] ?? a['http.scheme'] ?? 'http'}://${host}${port ? `:${port}` : ''}${local}`;
}

function headersOf(span: NormSpan | undefined): Record<string, string> | undefined {
  const raw = span?.attributes[REQUEST_HEADERS_ATTRIBUTE];
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
    const entries = Object.entries(parsed).filter(([, v]) => typeof v === 'string') as [string, string][];
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The request a SERVER span received, with `parent` the span that sent it. `body` is the raw
 * payload, or undefined to leave it out — the diagram's options decide whether it is carried.
 * A span cache recorded before the headers were captured simply has none to give.
 */
export function recordedRequest(
  server: NormSpan, parent: NormSpan | undefined, body: string | undefined,
): HttpRequest {
  const client = clientOf(parent);
  const url = client?.attributes['http.url'] ?? client?.attributes['url.full'] ?? urlFromServer(server);
  const headers = headersOf(client) ?? headersOf(server);
  return {
    method: methodOf(server, client),
    url,
    ...(headers ? {headers} : {}),
    ...(body?.trim() ? {body} : {}),
  };
}

/**
 * The request as an HTTP message: the request line, a `Name: value` line per header, then a
 * blank line and the body. The shape every HTTP client and RFC prints, so a reader takes it in
 * at a glance — and the body pretty-printed, which is the one liberty taken with the wire.
 */
export function requestMessage(request: HttpRequest): string {
  const head = [`${request.method} ${request.url}`,
    ...Object.entries(request.headers ?? {}).map(([name, value]) => `${name}: ${value}`)];
  const body = formatJsonDetail(request.body);
  return body ? `${head.join('\n')}\n\n${body}` : head.join('\n');
}
