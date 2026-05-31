import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { CORS_ORIGIN, getPort, OPENAPI_INFO } from './config/app-config';
import { validationExceptionFactory } from './common/all-exceptions.filter';

/**
 * Application bootstrap — mirrors the Java backend (CorsConfig + springdoc +
 * Spring Boot defaults):
 *
 *  - listens on PORT (default 8080);
 *  - CORS for the Angular dev server (http://localhost:4200) with credentials,
 *    exactly as CorsConfig.java;
 *  - global ValidationPipe { transform, whitelist } wired with
 *    validationExceptionFactory so class-validator errors reach the global
 *    RFC-7807 filter and get Java-style humanized messages (jakarta validation
 *    parity for @Validated @RequestBody);
 *  - Swagger UI at /swagger-ui (so /swagger-ui/index.html — the RootController
 *    redirect target — resolves) and the OpenAPI document at /v3/api-docs
 *    (JSON) and /v3/api-docs.yaml (YAML), matching springdoc's default paths so
 *    the OpenApiExtractor guardrail (GET /v3/api-docs.yaml) keeps working.
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
  const app = await NestFactory.create(AppModule);

  // CORS — mirror CorsConfig.java exactly.
  app.enableCors({
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: '*',
    exposedHeaders: ['errors', 'content-type'],
    credentials: true,
  });

  // Global validation — jakarta @Validated parity. The custom exception factory
  // preserves the raw ValidationError[] so AllExceptionsFilter can humanize them.
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      transformOptions: { enableImplicitConversion: false },
      exceptionFactory: validationExceptionFactory,
    }),
  );

  // OpenAPI / Swagger — metadata from openapi.info.* (application.properties).
  const swaggerConfig = new DocumentBuilder()
    .setTitle(OPENAPI_INFO.title)
    .setDescription(OPENAPI_INFO.description)
    .setVersion(OPENAPI_INFO.version)
    .setTermsOfService(OPENAPI_INFO.termsOfService)
    .addBasicAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('swagger-ui', app, document, {
    jsonDocumentUrl: 'v3/api-docs',
    yamlDocumentUrl: 'v3/api-docs.yaml',
  });

  await app.listen(getPort());
}

void bootstrap();
