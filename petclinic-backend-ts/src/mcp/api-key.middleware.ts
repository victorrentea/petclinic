import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { getMcpApiKeys } from '../config/app-config';

/**
 * X-API-Key authentication for the MCP routes (/sse, /sse/**, /mcp/**).
 *
 * Reads the `X-API-Key` header, maps it to an owner id via the configured
 * api-keys (demo-key-1=1, demo-key-2=2, demo-key-3=3) and, when valid, stamps
 * the resolved owner id onto the request. MCP requests without a recognised
 * key are rejected with 401.
 *
 * The resolved owner id is kept on the Express request and, for the SSE flow,
 * the MCP server remembers it per connection/session so that tool + resource
 * callbacks (which run on later POST /messages requests) can still resolve the
 * original caller. See {@link McpServerService}.
 */
export const API_KEY_HEADER = 'x-api-key';

/** Express request augmented with the authenticated MCP owner id. */
export interface McpAuthenticatedRequest extends Request {
  mcpOwnerId?: number;
}

/**
 * Resolves the owner id from an `X-API-Key` header value, or `undefined` when
 * the key is missing/unknown. Stateless.
 */
export function resolveOwnerIdFromApiKey(apiKey: string | undefined): number | undefined {
  if (!apiKey) {
    return undefined;
  }
  const keys = getMcpApiKeys();
  return keys[apiKey];
}

@Injectable()
export class ApiKeyMiddleware implements NestMiddleware {
  use(req: McpAuthenticatedRequest, res: Response, next: NextFunction): void {
    const header = req.headers[API_KEY_HEADER];
    const apiKey = Array.isArray(header) ? header[0] : header;
    const ownerId = resolveOwnerIdFromApiKey(apiKey);
    if (ownerId === undefined) {
      // Unauthenticated MCP requests are rejected before reaching the
      // SSE/message handlers.
      res.status(401).json({
        status: 401,
        title: 'Unauthorized',
        detail: 'Missing or invalid X-API-Key',
      });
      return;
    }
    req.mcpOwnerId = ownerId;
    next();
  }
}
