import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Response } from 'express';
import { McpServerService } from './mcp-server';
import { McpAuthenticatedRequest } from './api-key.middleware';
import { PermitAll } from '../common/security/permit-all.decorator';

/**
 * HTTP entry points for the MCP server:
 *   - GET  /sse            — open the SSE stream
 *   - POST /mcp/messages   — JSON-RPC message channel (sessionId in query)
 *
 * Auth is handled entirely by ApiKeyMiddleware (X-API-Key), NOT by the /api
 * RolesGuard. `@PermitAll` keeps the RolesGuard from also gating these routes.
 *
 * Excluded from Swagger (SSE/JSON-RPC, not part of the REST contract).
 */
@ApiExcludeController()
@PermitAll()
@Controller()
export class McpController {
  constructor(private readonly mcpServer: McpServerService) {}

  @Get('sse')
  async sse(@Req() req: McpAuthenticatedRequest, @Res() res: Response): Promise<void> {
    await this.mcpServer.handleSse(req, res);
  }

  @Post('mcp/messages')
  async messages(@Req() req: McpAuthenticatedRequest, @Res() res: Response): Promise<void> {
    await this.mcpServer.handleMessage(req, res);
  }
}
