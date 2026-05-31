/**
 * Centralised application configuration. All values are read from environment
 * variables, each with a sensible default.
 */

/** Port the HTTP server listens on. Defaults to 8080. */
export function getPort(): number {
  return parseInt(process.env.PORT ?? '8080', 10);
}

/**
 * Whether role-based security (HTTP Basic + RolesGuard) is enabled.
 * Read from PETCLINIC_SECURITY_ENABLE (default false = permit all).
 */
export function isSecurityEnabled(): boolean {
  return (process.env.PETCLINIC_SECURITY_ENABLE ?? 'false').toLowerCase() === 'true';
}

/**
 * Demo MCP API keys → owner id. Clients send the key in the `X-API-Key` header.
 * Default: demo-key-1=1, demo-key-2=2, demo-key-3=3.
 *
 * Optionally overridden via env PETCLINIC_MCP_API_KEYS in the form
 * "key1=1,key2=2,key3=3".
 */
export function getMcpApiKeys(): Record<string, number> {
  const raw = process.env.PETCLINIC_MCP_API_KEYS;
  if (!raw) {
    return {
      'demo-key-1': 1,
      'demo-key-2': 2,
      'demo-key-3': 3,
    };
  }
  const map: Record<string, number> = {};
  for (const pair of raw.split(',')) {
    const [key, value] = pair.split('=').map((s) => s.trim());
    if (key && value) {
      map[key] = parseInt(value, 10);
    }
  }
  return map;
}

/** OpenAPI / Swagger document metadata. */
export const OPENAPI_INFO = {
  title: 'REST Petclinic Backend API',
  version: '1.0',
  description:
    'This is the REST API documentation of the Petclinic backend. ' +
    'If authentication is enabled, use admin/admin when calling the APIs',
} as const;

/** Origin allowed by CORS, with credentials. */
export const CORS_ORIGIN = 'http://localhost:4200';
