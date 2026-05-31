import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Response } from 'express';
import { Repository } from 'typeorm';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { Owner } from '../owners/owner.entity';
import { Pet } from '../pets/pet.entity';
import { Visit } from '../visits/visit.entity';
import {
  OWNER_RESOURCE_DESCRIPTION,
  OWNER_RESOURCE_NAME,
  OWNER_RESOURCE_URI,
  buildOwnerProfileMarkdown,
} from './resources/owner.resource';
import {
  cancelVisit,
  createVisit,
  ElicitOutcome,
  listVisits,
  VisitToolContext,
  VisitToolRepos,
} from './tools/visit.tools';
import { McpAuthenticatedRequest } from './api-key.middleware';

/** The MCP server name / version advertised to clients. */
const MCP_SERVER_NAME = 'petclinic-mcp';
const MCP_SERVER_VERSION = '0.0.1';

/** Relative path the SSE transport tells clients to POST messages to. */
const MESSAGES_PATH = '/mcp/messages';

/**
 * The MCP server, wiring the owner resource and visit tools. A single
 * {@link McpServer} named 'petclinic-mcp' v0.0.1 exposing:
 *   - GET /sse — opens an SSE stream (one transport per connection)
 *   - POST /mcp/messages?sessionId=... — JSON-RPC messages for that stream
 *
 * Per-connection owner identity: over SSE the X-API-Key only rides the initial
 * GET /sse, so we remember `sessionId -> ownerId` and resolve it inside
 * tool/resource callbacks via `extra.sessionId`.
 */
@Injectable()
export class McpServerService implements OnModuleInit {
  private readonly logger = new Logger(McpServerService.name);
  private readonly server: McpServer;

  /** sessionId -> SSE transport, for routing POST /mcp/messages. */
  private readonly transports = new Map<string, SSEServerTransport>();
  /** sessionId -> authenticated owner id (set at GET /sse time). */
  private readonly sessionOwners = new Map<string, number>();

  constructor(
    @InjectRepository(Owner) private readonly ownerRepository: Repository<Owner>,
    @InjectRepository(Pet) private readonly petRepository: Repository<Pet>,
    @InjectRepository(Visit) private readonly visitRepository: Repository<Visit>,
  ) {
    this.server = new McpServer(
      { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
      { capabilities: { resources: {}, tools: {}, logging: {} } },
    );
  }

  onModuleInit(): void {
    this.registerOwnerResource();
    this.registerVisitTools();
  }

  private get repos(): VisitToolRepos {
    return {
      ownerRepository: this.ownerRepository,
      petRepository: this.petRepository,
      visitRepository: this.visitRepository,
    };
  }

  /** Resolves the owner id for the session running the current callback. */
  private ownerIdFor(sessionId: string | undefined): number {
    const ownerId = sessionId === undefined ? undefined : this.sessionOwners.get(sessionId);
    if (ownerId === undefined) {
      throw new Error('No authenticated MCP owner for this session');
    }
    return ownerId;
  }

  // ----- Resource: me://profile -------------------------------------------

  private registerOwnerResource(): void {
    this.server.registerResource(
      OWNER_RESOURCE_NAME,
      OWNER_RESOURCE_URI,
      { description: OWNER_RESOURCE_DESCRIPTION, mimeType: 'text/markdown' },
      async (uri, extra) => {
        const ownerId = this.ownerIdFor(extra.sessionId);
        const markdown = await buildOwnerProfileMarkdown(this.ownerRepository, ownerId);
        return {
          contents: [{ uri: uri.href, mimeType: 'text/markdown', text: markdown }],
        };
      },
    );
  }

  // ----- Tools: list_visits / create_visit / cancel_visit -----------------

  private registerVisitTools(): void {
    this.server.registerTool(
      'list_visits',
      {
        description: 'List veterinary visits for every pet of the authenticated owner.',
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async (extra) => {
        const ownerId = this.ownerIdFor(extra.sessionId);
        const visits = await listVisits(this.repos, ownerId);
        return { content: [{ type: 'text', text: JSON.stringify(visits) }] };
      },
    );

    this.server.registerTool(
      'create_visit',
      {
        description:
          'Create a new vet visit for one of the authenticated owner\'s pets. ' +
          'Asks the user (via elicitation) to confirm before writing.',
        inputSchema: {
          petId: z
            .number()
            .int()
            .describe('Pet ID (must belong to the authenticated owner)'),
          date: z
            .string()
            .describe('Visit date (yyyy-MM-dd); must be today or in the future'),
          description: z
            .string()
            .describe('Visit description (reason, diagnosis, notes...)'),
        },
      },
      async ({ petId, date, description }, extra) => {
        const ownerId = this.ownerIdFor(extra.sessionId);
        const context = this.elicitContext(extra.requestId, extra.sessionId);
        const message = await createVisit(
          this.repos,
          ownerId,
          context,
          petId,
          date,
          description,
        );
        return { content: [{ type: 'text', text: message }] };
      },
    );

    this.server.registerTool(
      'cancel_visit',
      {
        description:
          'Cancel an upcoming vet visit for one of the authenticated owner\'s pets. ' +
          'Only visits dated strictly in the future can be cancelled.',
        annotations: { destructiveHint: true },
        inputSchema: {
          date: z.string().describe('Visit date (yyyy-MM-dd); must be in the future'),
        },
      },
      async ({ date }, extra) => {
        const ownerId = this.ownerIdFor(extra.sessionId);
        const message = await cancelVisit(this.repos, ownerId, date);
        return { content: [{ type: 'text', text: message }] };
      },
    );
  }

  /**
   * Builds the elicitation bridge for create_visit. `elicitEnabled()` checks the
   * client's declared elicitation capability; `elicitPhone()` sends an
   * `elicitation/create` request (single string field `phone`) routed to the
   * current connection via `relatedRequestId`.
   */
  private elicitContext(
    requestId: string | number,
    sessionId: string | undefined,
  ): VisitToolContext {
    const server = this.server.server;
    return {
      elicitEnabled(): boolean {
        return server.getClientCapabilities()?.elicitation != null;
      },
      elicitPhone: async (message: string): Promise<ElicitOutcome> => {
        const result = await server.elicitInput(
          {
            message,
            requestedSchema: {
              type: 'object',
              properties: {
                phone: {
                  type: 'string',
                  title: 'Phone number',
                  description: 'A phone number to receive visit reminders',
                },
              },
              required: ['phone'],
            },
          },
          { relatedRequestId: requestId },
        );
        // ElicitResult.content is a flat record; coerce phone to string.
        const phone = result.content?.['phone'];
        return {
          action: result.action,
          content: { phone: phone == null ? undefined : String(phone) },
        };
      },
    };
  }

  // ----- SSE transport plumbing -------------------------------------------

  /**
   * GET /sse — opens a new SSE stream. The owner id (resolved by
   * ApiKeyMiddleware from X-API-Key) is bound to the new session id so later
   * POST /mcp/messages callbacks can recover the caller.
   */
  async handleSse(req: McpAuthenticatedRequest, res: Response): Promise<void> {
    const ownerId = req.mcpOwnerId;
    if (ownerId === undefined) {
      res.status(401).end();
      return;
    }
    const transport = new SSEServerTransport(MESSAGES_PATH, res);
    const sessionId = transport.sessionId;
    this.transports.set(sessionId, transport);
    this.sessionOwners.set(sessionId, ownerId);

    transport.onclose = () => {
      this.transports.delete(sessionId);
      this.sessionOwners.delete(sessionId);
    };
    res.on('close', () => {
      this.transports.delete(sessionId);
      this.sessionOwners.delete(sessionId);
    });

    await this.server.connect(transport);
    this.logger.log(`MCP SSE connected: session=${sessionId} owner=${ownerId}`);
  }

  /**
   * POST /mcp/messages?sessionId=... — delivers a JSON-RPC message to the SSE
   * stream identified by sessionId.
   */
  async handleMessage(req: McpAuthenticatedRequest, res: Response): Promise<void> {
    const sessionId = req.query['sessionId'];
    const id = Array.isArray(sessionId) ? sessionId[0] : sessionId;
    const transport = typeof id === 'string' ? this.transports.get(id) : undefined;
    if (!transport) {
      res.status(404).json({ status: 404, title: 'Not Found', detail: 'Unknown sessionId' });
      return;
    }
    await transport.handlePostMessage(req, res, req.body);
  }
}
