import { join } from 'path';
import { DataSourceOptions } from 'typeorm';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * Builds the shared Postgres connection options used both by the standalone
 * TypeORM DataSource (for migrations / CLI) and by NestJS' TypeOrmModule.
 *
 * Env (with defaults mirroring the Java backend / start-database.sh):
 *   DB_HOST=localhost
 *   DB_PORT=5432
 *   DB_NAME=petclinic
 *   DB_USER=petclinic
 *   DB_PASS=petclinic
 *
 * Flyway owns the schema in the Java app; here TypeORM migrations do.
 * synchronize is ALWAYS false — never auto-DDL.
 */
export function buildDataSourceOptions(): DataSourceOptions {
  return {
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    database: process.env.DB_NAME ?? 'petclinic',
    username: process.env.DB_USER ?? 'petclinic',
    password: process.env.DB_PASS ?? 'petclinic',
    synchronize: false,
    logging: (process.env.DB_LOGGING ?? 'false').toLowerCase() === 'true',
    // Match against both .ts (ts-node / dev) and .js (compiled dist) artefacts.
    entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
    migrations: [join(__dirname, '..', 'migrations', '*.{ts,js}')],
  };
}

/**
 * Adapter for TypeOrmModule.forRootAsync — same options, typed for NestJS.
 */
export function buildTypeOrmModuleOptions(): TypeOrmModuleOptions {
  return {
    ...buildDataSourceOptions(),
    autoLoadEntities: true,
  };
}
