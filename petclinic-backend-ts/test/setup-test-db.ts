import 'reflect-metadata';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../src/config/typeorm.config';

/**
 * Creates and migrates an ISOLATED database for the e2e suite, so the tests —
 * which TRUNCATE every table between cases — never touch the development
 * database. Run by the `test:e2e` npm script before Jest; the specs connect to
 * this database because jest-e2e.setup.ts forces DB_NAME=petclinic_test.
 *
 * Safe to run repeatedly: the database is created only if missing and the
 * migrations are idempotent. If Postgres is unreachable, it logs and exits 0 so
 * the e2e suite degrades to "skipped" rather than failing.
 */
// Hardcoded (not read from DB_NAME) so the e2e suite can never be pointed at,
// and TRUNCATE, the development database.
const TEST_DB = 'petclinic_test';

async function main(): Promise<void> {
  const host = process.env.DB_HOST ?? 'localhost';
  const port = parseInt(process.env.DB_PORT ?? '5432', 10);
  const user = process.env.DB_USER ?? 'petclinic';
  const password = process.env.DB_PASS ?? 'petclinic';

  // Connect to the default database to (re)create the isolated test database;
  // CREATE DATABASE cannot run against the database being created.
  const admin = new Client({ host, port, user, password, database: 'petclinic' });
  try {
    await admin.connect();
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[e2e] Postgres not reachable on ${host}:${port} (${reason}).`);
    console.warn('[e2e] Skipping test-DB setup — e2e tests will skip. Start ./start-database.sh to run them.');
    return;
  }

  const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [TEST_DB]);
  if (existing.rowCount === 0) {
    await admin.query(`CREATE DATABASE ${TEST_DB}`);
    console.log(`[e2e] created database ${TEST_DB}`);
  }
  await admin.end();

  // Apply the TypeORM migrations to the isolated database (idempotent).
  process.env.DB_NAME = TEST_DB;
  const ds = new DataSource(buildDataSourceOptions());
  await ds.initialize();
  await ds.runMigrations();
  await ds.destroy();
  console.log(`[e2e] ${TEST_DB} schema is up to date`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
