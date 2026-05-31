// Loaded before any decorated entity/DTO/controller is imported by the e2e specs.
import 'reflect-metadata';

// Force the e2e suite onto an ISOLATED database. The specs TRUNCATE every table
// between cases, so they must NEVER run against the development database. The
// `test:e2e` npm script creates + migrates this database first (setup-test-db.ts).
// DB_HOST/DB_PORT/DB_USER/DB_PASS stay overridable; only the name is pinned.
process.env.DB_NAME = 'petclinic_test';
