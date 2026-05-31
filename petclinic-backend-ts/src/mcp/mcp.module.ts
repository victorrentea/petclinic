import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Owner } from '../owners/owner.entity';
import { Pet } from '../pets/pet.entity';
import { Visit } from '../visits/visit.entity';
import { McpServerService } from './mcp-server';
import { McpController } from './mcp.controller';
import { ApiKeyMiddleware } from './api-key.middleware';

/**
 * MCP feature module.
 *
 * No service layer: McpServerService injects the TypeORM repositories for
 * Owner/Pet/Visit directly and the stateless resource/tool functions operate
 * on them.
 *
 * ApiKeyMiddleware is bound to the MCP routes only (GET /sse,
 * POST /mcp/messages) — the X-API-Key chain that gates "/sse", "/sse/**" and
 * "/mcp/**" independently of the /api authorization.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Owner, Pet, Visit])],
  controllers: [McpController],
  providers: [McpServerService],
})
export class McpModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(ApiKeyMiddleware)
      .forRoutes(
        { path: 'sse', method: RequestMethod.GET },
        { path: 'mcp/messages', method: RequestMethod.POST },
      );
  }
}
