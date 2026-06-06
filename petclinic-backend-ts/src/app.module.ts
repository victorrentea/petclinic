import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';

import { buildTypeOrmModuleOptions } from './config/typeorm.config';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

import { OwnersModule } from './owners/owners.module';
import { PetsModule } from './pets/pets.module';
import { VetsModule } from './vets/vets.module';
import { SpecialtiesModule } from './specialties/specialties.module';
import { VisitsModule } from './visits/visits.module';
import { UsersModule } from './users/users.module';
import { RootModule } from './root/root.module';
import { SecurityModule } from './security/security.module';
import { RolesGuard } from './security/roles.guard';
import { McpModule } from './mcp/mcp.module';

/**
 * Root application module wiring.
 *
 *  - ConfigModule (global): env-driven configuration.
 *  - TypeOrmModule.forRootAsync: single Postgres connection, synchronize:false,
 *    autoLoadEntities so every feature module's forFeature entities are picked up.
 *  - Every per-domain feature module (no service layer — controllers inject the
 *    TypeORM repositories directly).
 *  - SecurityModule + global RolesGuard (APP_GUARD): permit-all by default; role
 *    checks only enforced when PETCLINIC_SECURITY_ENABLE=true.
 *  - McpModule: the MCP SSE server, served at root paths (/sse,
 *    /mcp/messages) guarded by its own X-API-Key middleware.
 *  - AllExceptionsFilter (APP_FILTER): the global RFC-7807 ProblemDetail handler.
 */
@Module({
  imports: [
    // Structured logging via Pino. OpenTelemetry's pino instrumentation
    // (loaded by the auto-instrumentations register hook) bridges these log
    // records to the OTLP logs pipeline → Grafana Loki when
    // OTEL_LOGS_EXPORTER=otlp, and stamps each line with the active trace id.
    LoggerModule.forRoot({
      pinoHttp: { autoLogging: true },
    }),
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => buildTypeOrmModuleOptions(),
    }),
    // Feature modules (one per REST domain).
    OwnersModule,
    PetsModule,
    VetsModule,
    SpecialtiesModule,
    VisitsModule,
    UsersModule,
    RootModule,
    // Cross-cutting concerns.
    SecurityModule,
    McpModule,
  ],
  providers: [
    // Global RFC-7807 exception filter.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Global authorization guard.
    // No-ops when PETCLINIC_SECURITY_ENABLE != true (default), so it is safe
    // to register globally; honors @PermitAll on the MCP controller.
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
