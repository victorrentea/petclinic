import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';
import { AllExceptionsFilter, validationExceptionFactory } from '../src/common/all-exceptions.filter';
import { buildDataSourceOptions } from '../src/config/typeorm.config';
import { AppDataSource } from '../src/data-source';

/**
 * Shared e2e test harness.
 *
 * These e2e tests point at a real Postgres via the standard DB_* env vars
 * (defaults: localhost:5432 / petclinic / petclinic / petclinic — same as
 * start-database.sh).
 *
 *   DB_HOST   (default localhost)
 *   DB_PORT   (default 5432)
 *   DB_NAME   (default petclinic)
 *   DB_USER   (default petclinic)
 *   DB_PASS   (default petclinic)
 *
 * If no Postgres is reachable, {@link isDbAvailable} returns false and every
 * suite logs a clear skip + returns early (Jest cannot truly skip from inside
 * beforeAll, so each test guards on the flag). This keeps `npm run test:e2e`
 * green-or-skipped rather than red when the DB is absent.
 *
 * The app is bootstrapped EXACTLY like src/main.ts (global ValidationPipe with
 * validationExceptionFactory + the RFC-7807 AllExceptionsFilter), so the wire
 * behaviour (status codes, Location headers, ProblemDetail bodies) matches the
 * running server. Security stays permit-all (PETCLINIC_SECURITY_ENABLE unset),
 * so no authentication is required.
 */

let cachedAvailability: boolean | null = null;

/** Probes the configured Postgres once; result is cached for the whole run. */
export async function isDbAvailable(): Promise<boolean> {
  if (cachedAvailability !== null) {
    return cachedAvailability;
  }
  const probe = new DataSource(buildDataSourceOptions());
  try {
    await probe.initialize();
    await probe.destroy();
    cachedAvailability = true;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.warn(
      `\n[e2e] Postgres is NOT reachable (${reason}).\n` +
        `[e2e] Skipping e2e tests. Start a Postgres (see ../start-database.sh) and set\n` +
        `[e2e] DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASS to run them.\n`,
    );
    cachedAvailability = false;
  }
  return cachedAvailability;
}

/** Ensures the schema exists by running the TypeORM migrations (idempotent). */
export async function ensureSchema(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  await AppDataSource.runMigrations();
}

let app: INestApplication | null = null;
let dataSource: DataSource | null = null;

/**
 * Boots the full Nest application against the test DB and returns it.
 * Idempotent across a suite — call once in beforeAll.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const created = moduleRef.createNestApplication();

  // Mirror src/main.ts wiring (the bits that affect the wire contract).
  created.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      transformOptions: { enableImplicitConversion: false },
      exceptionFactory: validationExceptionFactory,
    }),
  );
  created.useGlobalFilters(new AllExceptionsFilter());

  await created.init();

  app = created;
  dataSource = created.get(DataSource);
  return created;
}

/** The application's TypeORM DataSource (for direct fixture setup/teardown). */
export function getDataSource(): DataSource {
  if (!dataSource) {
    throw new Error('Test app not initialized — call createTestApp() first.');
  }
  return dataSource;
}

/**
 * Truncates every mutable table between tests so each test starts from a clean,
 * deterministic state. Identity sequences are restarted so freshly inserted rows
 * get low ids. The order respects FKs; CASCADE covers join tables.
 */
export async function cleanDatabase(): Promise<void> {
  const ds = getDataSource();
  await ds.query(
    'TRUNCATE TABLE visits, pets, owners, vet_specialties, vets, specialties, types, roles, users RESTART IDENTITY CASCADE',
  );
}

/** Tears down the Nest app + the standalone migration DataSource. */
export async function closeTestApp(): Promise<void> {
  if (app) {
    await app.close();
    app = null;
    dataSource = null;
  }
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}
