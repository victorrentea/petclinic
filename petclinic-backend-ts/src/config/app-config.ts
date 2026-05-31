/**
 * Centralised application configuration, mirroring the Spring Boot
 * application.properties. All values are read from environment variables
 * with the same defaults as the Java backend.
 *
 * Java reference: petclinic-backend/src/main/resources/application.properties
 */

/** Port the HTTP server listens on. Java backend runs on 8080. */
export function getPort(): number {
  return parseInt(process.env.PORT ?? '8080', 10);
}

/**
 * Whether role-based security (HTTP Basic + RolesGuard) is enabled.
 * Mirrors `petclinic.security.enable` (default false = permit all).
 */
export function isSecurityEnabled(): boolean {
  return (process.env.PETCLINIC_SECURITY_ENABLE ?? 'false').toLowerCase() === 'true';
}

/**
 * Demo MCP API keys → owner id, mirroring `petclinic.mcp.api-keys.*`.
 * Clients send the key in the `X-API-Key` header.
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

/** OpenAPI / Swagger metadata, mirroring `openapi.info.*`. */
export const OPENAPI_INFO = {
  title: 'REST Petclinic Backend API',
  version: '1.0',
  termsOfService:
    'https://github.com/spring-petclinic/petclinic-rest/blob/master/terms.txt',
  description:
    'This is the REST API documentation of the Spring Petclinic backend. ' +
    'If authentication is enabled, use admin/admin when calling the APIs',
} as const;

/** Origin allowed by CORS, with credentials. Mirrors CorsConfig. */
export const CORS_ORIGIN = 'http://localhost:4200';
