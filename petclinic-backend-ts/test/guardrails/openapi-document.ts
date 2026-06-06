/**
 * Offline OpenAPI document builder shared by the generate + diff guardrail.
 *
 * Boots the real NestJS `AppModule` and runs `SwaggerModule.createDocument`
 * exactly as `src/main.ts` does — so the emitted document is what the live
 * `/v3/api-docs.yaml` endpoint would serve — but WITHOUT opening a Postgres
 * connection.
 *
 * The no-DB trick: TypeORM only needs a live connection to *run queries*. The
 * OpenAPI document is derived purely from the controllers, their route
 * decorators and the DTO `@ApiProperty` metadata — none of which touch the
 * database. We therefore neutralize the network half of `DataSource` (the
 * driver `connect()` / `afterConnect()`), while still letting TypeORM build its
 * entity metadata offline from the decorators. `forRoot`/`forFeature` then wire
 * real (but unconnected) repositories, NestFactory builds the whole controller
 * graph, and Swagger introspects it without ever hitting Postgres.
 */
import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { DataSource } from 'typeorm';

import { AppModule } from '../../src/app.module';
import { OPENAPI_INFO } from '../../src/config/app-config';

// js-yaml ships no bundled types and @types/js-yaml is not a project dependency
// (the guardrails phase must not mutate package.json / the lockfile while other
// modules are written in parallel). Require it with a narrow local type.
interface YamlDumpOptions {
  sortKeys?: boolean;
  noRefs?: boolean;
  lineWidth?: number;
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const yaml = require('js-yaml') as { dump(o: unknown, opts?: YamlDumpOptions): string };

/**
 * Neutralizes the network half of `DataSource`, ONCE, at module load:
 *
 *  - `initialize()` builds the ORM metadata (offline, from the entity
 *    decorators) and flips `isInitialized` to true, but never calls the
 *    driver's `connect()`;
 *  - `buildMetadatas()` is wrapped to swallow the relation-integrity validation
 *    that runs as its final step (the metadata is fully populated by then,
 *    which is all the repository providers need). This guards BOTH the init
 *    path and the async retry/teardown paths that TypeOrmCoreModule drives in
 *    the background.
 *
 * The patch is applied permanently (the guardrail process is short-lived and
 * single-purpose), which also covers TypeOrmCoreModule's background async
 * connection retry — that would otherwise re-run the throwing validation AFTER
 * doc generation finished and crash the process with an unhandled rejection.
 *
 * NOTE: the live app's `DataSource.initialize()` still runs that validation, so
 * any relation-validation issue must be fixed before the backend can start.
 */
function neutralizeDataSourceConnectionOnce(): void {
  const proto = DataSource.prototype as unknown as {
    initialize: () => Promise<DataSource>;
    buildMetadatas: () => void;
    isInitialized: boolean;
    __offlinePatched?: boolean;
  };
  if (proto.__offlinePatched) return;
  proto.__offlinePatched = true;

  const originalBuildMetadatas = proto.buildMetadatas;
  proto.buildMetadatas = function safeBuildMetadatas(this: DataSource): void {
    try {
      originalBuildMetadatas.call(this);
    } catch {
      // Relation-validation errors are about runtime integrity, not the API
      // contract; the metadata is already built. Safe to ignore for doc-gen.
    }
  };

  proto.initialize = async function offlineInitialize(this: DataSource): Promise<DataSource> {
    const self = this as unknown as { isInitialized: boolean; buildMetadatas: () => void };
    self.buildMetadatas();
    self.isInitialized = true;
    return this;
  };
}

// Apply before AppModule / TypeOrmModule wire up any DataSource.
neutralizeDataSourceConnectionOnce();

/**
 * TypeOrmModule.forRootAsync drives a background async DataSource init (with a
 * retry pipeline) that is not awaited by NestFactory. After the offline doc has
 * been generated, that background promise can reject with TypeORM's
 * `InitializedRelationError` (the entities use `= []` relation initializers,
 * which is a real entity-phase issue, reported in GUARDRAILS.md — but unrelated
 * to the OpenAPI contract). Ignore ONLY that specific error so the short-lived
 * guardrail process exits cleanly; let every other rejection surface.
 */
process.on('unhandledRejection', (reason: unknown) => {
  const name = reason instanceof Error ? reason.constructor.name : '';
  if (name === 'InitializedRelationError') {
    return;
  }
  throw reason;
});

/**
 * Boots the real AppModule with the TypeORM connection neutralized and returns
 * an initialized Nest application ready for Swagger introspection.
 */
export async function bootAppOffline(): Promise<INestApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  await app.init();
  return app;
}

/**
 * Builds the Swagger document with the SAME DocumentBuilder config as
 * `src/main.ts`, so the result matches the live `/v3/api-docs.yaml`.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle(OPENAPI_INFO.title)
    .setDescription(OPENAPI_INFO.description)
    .setVersion(OPENAPI_INFO.version)
    .addBasicAuth()
    .build();
  return SwaggerModule.createDocument(app, config);
}

/** Renders an OpenAPI document as deterministic, sorted YAML. */
export function toYaml(document: OpenAPIObject): string {
  return yaml.dump(document, { sortKeys: true, noRefs: true, lineWidth: -1 });
}

/** One-shot helper: boot, build, render, tear down. Returns the YAML string. */
export async function generateOpenApiYaml(): Promise<string> {
  const app = await bootAppOffline();
  try {
    const document = buildOpenApiDocument(app);
    return toYaml(document);
  } finally {
    await app.close();
  }
}
