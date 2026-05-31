import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { CORS_ORIGIN, getPort, OPENAPI_INFO } from './config/app-config';
import { validationExceptionFactory } from './common/all-exceptions.filter';

/**
 * Application bootstrap:
 *
 *  - listens on PORT (default 8080);
 *  - CORS for the Angular dev server (http://localhost:4200) with credentials;
 *  - global ValidationPipe { transform, whitelist } wired with
 *    validationExceptionFactory so class-validator errors reach the global
 *    RFC-7807 filter and get humanized messages for validated request bodies;
 *  - Swagger UI at /swagger-ui (so /swagger-ui/index.html — the RootController
 *    redirect target — resolves) and the OpenAPI document at /v3/api-docs
 *    (JSON) and /v3/api-docs.yaml (YAML), the paths the OpenApiExtractor
 *    guardrail (GET /v3/api-docs.yaml) reads.
 *
 * The global exception filter (AllExceptionsFilter) and the global RolesGuard
 * are registered as APP_FILTER / APP_GUARD providers in AppModule.
 *
 * MCP /sse + /mcp/messages are plain Nest controller routes on this same Express
 * server (shared port + CORS); their X-API-Key auth runs as a route-scoped
 * middleware ahead of the handlers, and the controller is @PermitAll() so the
 * global RolesGuard does not also gate them. No global prefix is set, so the
 * root '/' redirect and the MCP root paths remain reachable.
 */
async function bootstrap(): Promise<void> {
  // bufferLogs so early framework logs are replayed through Pino once the
  // app-level logger is installed below.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));

  // CORS configuration for the Angular dev server.
  app.enableCors({
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: '*',
    exposedHeaders: ['errors', 'content-type'],
    credentials: true,
  });

  // Global validation. The custom exception factory preserves the raw
  // ValidationError[] so AllExceptionsFilter can humanize them.
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      transformOptions: { enableImplicitConversion: false },
      exceptionFactory: validationExceptionFactory,
    }),
  );

  // OpenAPI / Swagger document, built from the OPENAPI_INFO metadata.
  const swaggerConfig = new DocumentBuilder()
    .setTitle(OPENAPI_INFO.title)
    .setDescription(OPENAPI_INFO.description)
    .setVersion(OPENAPI_INFO.version)
    .addBasicAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('swagger-ui', app, document, {
    jsonDocumentUrl: 'v3/api-docs',
    yamlDocumentUrl: 'v3/api-docs.yaml',
  });

  const port = getPort();
  await app.listen(port);

  // Announce the port on successful startup so it is obvious which backend the
  // Angular frontend (http://localhost:4200 → REST_API_URL :8080) is talking to.
  Logger.log(
    `✅ Petclinic TS backend (NestJS) started on http://localhost:${port}`,
    'Bootstrap',
  );
  Logger.log(`   Swagger UI: http://localhost:${port}/swagger-ui`, 'Bootstrap');
}

void bootstrap();
