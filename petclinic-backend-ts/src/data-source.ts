import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './config/typeorm.config';

/**
 * Standalone TypeORM DataSource used by the TypeORM CLI for migrations.
 *
 * Usage:
 *   npm run migration:run
 *   npm run typeorm -- migration:generate src/migrations/Name -d src/data-source.ts
 */
// Exactly ONE DataSource export — the TypeORM CLI (`-d src/data-source.ts`)
// rejects a file that exports a DataSource both as a named and a default export
// ("must contain only one export of DataSource instance").
export const AppDataSource = new DataSource(buildDataSourceOptions());
