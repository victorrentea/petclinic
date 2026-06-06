/**
 * Schema / entity sync guardrail.
 *
 * Asserts the entity metadata matches the schema declared by the migrations,
 * without needing a live database. TypeORM collects every `@Entity` /
 * `@Column` / `@JoinColumn` / `@JoinTable` declaration into the global
 * `getMetadataArgsStorage()` the moment the entity modules are imported
 * (decorator side-effects) — no `DataSource.initialize()` / no connection. We
 * cross-check that metadata against the table & column names declared in the
 * committed TypeORM migrations (the single source of truth for the schema).
 *
 * This catches the realistic drift:
 *   - an entity table/column the migrations never create, and
 *   - a migrated table that has no owning entity.
 *
 * Caveat (documented in GUARDRAILS.md): this check is lax on column *types*,
 * *length* and *nullability* — it only asserts the set of table and column
 * NAMES line up. A type/length regression is not caught here (it would surface
 * at runtime against the real Postgres).
 */
import 'reflect-metadata';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getMetadataArgsStorage } from 'typeorm';

// Importing the entity classes runs their decorators, which is what populates
// getMetadataArgsStorage(). Keep this list in sync with src/**/*.entity.ts.
import { Owner } from '../../src/owners/owner.entity';
import { Pet } from '../../src/pets/pet.entity';
import { PetType } from '../../src/pet-types/pet-type.entity';
import { Visit } from '../../src/visits/visit.entity';
import { Vet } from '../../src/vets/vet.entity';
import { Specialty } from '../../src/specialties/specialty.entity';
import { User } from '../../src/users/user.entity';
import { Role } from '../../src/users/role.entity';

// Reference the imports so tree-shaking / lint never drops the decorator
// side-effects that fill the metadata storage.
const ENTITIES = [Owner, Pet, PetType, Visit, Vet, Specialty, User, Role];

const MIGRATIONS_DIR = join(__dirname, '..', '..', 'src', 'migrations');
const MIGRATION_FILES = [
  '1700000000001-CoreOwnersPets.ts',
  '1700000000002-AddVetsAndSecurity.ts',
  '1700000000004-AddVetToVisit.ts',
];

interface TableSchema {
  columns: Set<string>;
}

/**
 * Parses every `CREATE TABLE <name> ( ... )` block out of the committed
 * migration files and extracts the leading identifier of each column/constraint
 * line. Constraint keywords (PRIMARY/FOREIGN/UNIQUE/CONSTRAINT/CHECK) are
 * dropped so only real column names remain.
 *
 * Columns added later via `ALTER TABLE <name> ADD COLUMN <col>` are folded
 * into the owning table (files are processed in chronological order, so the
 * CREATE TABLE is always seen before the ALTER).
 */
function parseMigrationSchema(): Map<string, TableSchema> {
  const tables = new Map<string, TableSchema>();
  const createTable = /CREATE TABLE\s+(\w+)\s*\(([\s\S]*?)\)\s*`/gi;
  const addColumn = /ALTER TABLE\s+(\w+)\s+ADD COLUMN\s+(\w+)/gi;

  for (const file of MIGRATION_FILES) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    let match: RegExpExecArray | null;
    while ((match = createTable.exec(sql)) !== null) {
      const tableName = match[1].toLowerCase();
      const body = match[2];
      const columns = new Set<string>();
      for (const rawLine of body.split('\n')) {
        const line = rawLine.trim().replace(/,$/, '');
        if (!line) continue;
        const firstToken = line.split(/[\s(]+/)[0].toUpperCase();
        if (['PRIMARY', 'FOREIGN', 'UNIQUE', 'CONSTRAINT', 'CHECK'].includes(firstToken)) {
          continue;
        }
        const name = line.split(/[\s(]+/)[0].toLowerCase();
        if (/^[a-z_][a-z0-9_]*$/.test(name)) {
          columns.add(name);
        }
      }
      tables.set(tableName, { columns });
    }
    while ((match = addColumn.exec(sql)) !== null) {
      const table = tables.get(match[1].toLowerCase());
      if (table) {
        table.columns.add(match[2].toLowerCase());
      }
    }
  }
  return tables;
}

/**
 * Reconstructs the table → column-name model that TypeORM will materialize from
 * the entity decorators, using only the offline metadata-args storage.
 *
 *  - regular @Column / @PrimaryColumn / @PrimaryGeneratedColumn  -> a column
 *    (name defaults to the property name when no explicit { name } given);
 *  - @ManyToOne / @OneToOne owning side -> its @JoinColumn name (FK column);
 *  - @JoinTable (@ManyToMany owning side) -> a separate join table with its two
 *    join-column names.
 *
 * Inverse sides (@OneToMany, mappedBy @ManyToMany, relations without a
 * JoinColumn on this side) own no physical column and are skipped.
 */
function buildEntitySchema(): Map<string, TableSchema> {
  const storage = getMetadataArgsStorage();
  const tables = new Map<string, TableSchema>();

  // target class -> table name
  const tableNameByTarget = new Map<Function, string>();
  for (const t of storage.tables) {
    if (typeof t.target !== 'function') continue;
    const name = (t.name ?? t.target.name).toLowerCase();
    tableNameByTarget.set(t.target, name);
    if (!tables.has(name)) tables.set(name, { columns: new Set() });
  }

  // plain columns (incl. primary columns)
  for (const col of storage.columns) {
    if (typeof col.target !== 'function') continue;
    const tableName = tableNameByTarget.get(col.target);
    if (!tableName) continue;
    const colName = (col.options.name ?? col.propertyName).toLowerCase();
    tables.get(tableName)!.columns.add(colName);
  }

  // owning-side relation FK columns (@JoinColumn)
  for (const jc of storage.joinColumns) {
    if (typeof jc.target !== 'function') continue;
    const tableName = tableNameByTarget.get(jc.target);
    if (!tableName || !jc.name) continue;
    tables.get(tableName)!.columns.add(jc.name.toLowerCase());
  }

  // @ManyToMany owning side -> a dedicated join table
  for (const jt of storage.joinTables) {
    const name = (jt.name ?? '').toLowerCase();
    if (!name) continue;
    const columns = new Set<string>();
    for (const c of jt.joinColumns ?? []) {
      if (c.name) columns.add(c.name.toLowerCase());
    }
    for (const c of jt.inverseJoinColumns ?? []) {
      if (c.name) columns.add(c.name.toLowerCase());
    }
    tables.set(name, { columns });
  }

  return tables;
}

describe('schema/entity sync guardrail', () => {
  const migrationSchema = parseMigrationSchema();
  const entitySchema = buildEntitySchema();

  it('parses the expected set of tables from the migrations', () => {
    expect([...migrationSchema.keys()].sort()).toEqual(
      ['owners', 'pets', 'roles', 'specialties', 'types', 'users', 'vet_specialties', 'vets', 'visits'].sort(),
    );
  });

  it('discovers every entity in the metadata storage', () => {
    // 8 entities + the vet_specialties join table = 9 physical tables.
    expect(entitySchema.size).toBeGreaterThanOrEqual(9);
  });

  it('maps every entity table to a migrated table (no entity-only tables)', () => {
    const orphanTables = [...entitySchema.keys()].filter((t) => !migrationSchema.has(t));
    expect(orphanTables).toEqual([]);
  });

  it('maps every migrated table to an entity table (no orphan migrated tables)', () => {
    const orphanTables = [...migrationSchema.keys()].filter((t) => !entitySchema.has(t));
    expect(orphanTables).toEqual([]);
  });

  it('matches every entity column to a migrated column of the same table', () => {
    const drift: string[] = [];
    for (const [table, schema] of entitySchema) {
      const migrated = migrationSchema.get(table);
      if (!migrated) continue; // table mismatch already reported above
      for (const col of schema.columns) {
        if (!migrated.columns.has(col)) {
          drift.push(`${table}.${col} (entity column missing from migration)`);
        }
      }
    }
    expect(drift).toEqual([]);
  });

  it('matches every migrated column to an entity column of the same table', () => {
    const drift: string[] = [];
    for (const [table, schema] of migrationSchema) {
      const entity = entitySchema.get(table);
      if (!entity) continue;
      for (const col of schema.columns) {
        if (!entity.columns.has(col)) {
          drift.push(`${table}.${col} (migrated column has no entity field)`);
        }
      }
    }
    expect(drift).toEqual([]);
  });
});
