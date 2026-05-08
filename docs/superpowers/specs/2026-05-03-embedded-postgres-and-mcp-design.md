# Embedded Postgres + Flyway + MCP for PetClinic Workshop

**Date:** 2026-05-03
**Goal:** Replace the Postgres-via-Docker setup with a single embedded Postgres started by a sibling Java project, managed by Flyway migrations, and queryable via the dbhub MCP server. Designed so workshop students can run the full stack without Docker.

## Motivation

The current `petclinic-backend/` ships with Postgres (via `docker-compose --profile postgres`). For a workshop demo where students should query the running database via an LLM (using the dbhub MCP server), the Docker route is the only viable option — but several students don't have Docker Desktop installed.

The replacement: a tiny standalone Java project (`petclinic-database`) that uses `io.zonky.test:embedded-postgres` to download and launch a real Postgres binary as a subprocess on `localhost:5432`. The backend connects to it like any external Postgres. The dbhub MCP server, configured at the project root, also connects to it.

A secondary goal: convert the existing single-shot `schema.sql`/`data.sql` files into Flyway migrations to demonstrate incremental schema evolution.

## Top-Level Layout

```
petclinic-clone/
├── petclinic-backend/          (refactored — single DB target, Flyway-managed)
├── petclinic-database/         (NEW — embedded-postgres launcher)
│   ├── pom.xml
│   ├── src/main/java/ro/victorrentea/petclinic/db/PostgresLauncher.java
│   └── data/                   (Postgres data directory; gitignored)
├── petclinic-frontend/         (untouched)
├── start-database.sh           (NEW)
├── start-backend.sh            (existing)
├── start-frontend.sh           (existing)
└── .mcp.json                   (NEW — dbhub MCP config)
```

## Component 1: `petclinic-database/`

**Purpose:** Start an embedded Postgres instance on `localhost:5432`, persist data in `petclinic-database/data/`, and block until killed.

**Stack:** Standalone Maven project (no parent pom), Java 21, single executable class.

**`PostgresLauncher.java`:**
```java
package ro.victorrentea.petclinic.db;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.nio.file.Path;
import java.nio.file.Paths;

public class PostgresLauncher {
  public static void main(String[] args) throws Exception {
    Path dataDir = Paths.get("data").toAbsolutePath();
    var pg = EmbeddedPostgres.builder()
        .setPort(5432)
        .setDataDirectory(dataDir)
        .setCleanDataDirectory(false)
        .start();
    System.out.println("Postgres started:");
    System.out.println("  JDBC URL: " + pg.getJdbcUrl("petclinic", "petclinic"));
    System.out.println("  Data dir: " + dataDir);
    System.out.println("Press Ctrl+C to stop.");
    Thread.currentThread().join();
  }
}
```

**Notes:**
- `setCleanDataDirectory(false)` preserves data across restarts.
- Default Postgres user from zonky is `postgres`; we will create a `petclinic`/`petclinic` role + `petclinic` database via a one-time bootstrap (see "First-run bootstrap" below).
- The launcher process owns the Postgres subprocess; killing the launcher stops Postgres cleanly.

**`pom.xml`:**
- `io.zonky.test:embedded-postgres:2.0.7`
- `io.zonky.test:embedded-postgres-binaries-bom:16.2.0` (BOM for binary versions)
- `maven-shade-plugin` to produce `petclinic-database.jar` with `Main-Class: ro.victorrentea.petclinic.db.PostgresLauncher`

**First-run bootstrap:**
On first start, zonky creates a Postgres cluster with default superuser `postgres` and default database `postgres`. To match the credentials the backend expects (user `petclinic`, password `petclinic`, database `petclinic`), the launcher checks for marker file `data/.bootstrapped`; if absent, it opens a JDBC connection via `pg.getPostgresDatabase()` (the default-superuser DataSource) and executes:
```sql
CREATE USER petclinic WITH PASSWORD 'petclinic';
CREATE DATABASE petclinic OWNER petclinic;
GRANT ALL PRIVILEGES ON DATABASE petclinic TO petclinic;
```
Then writes `data/.bootstrapped`. Subsequent runs skip the bootstrap; the role and database persist in the data directory.

**`.gitignore`** addition: `petclinic-database/data/`

## Component 2: `petclinic-backend/` Refactor

### Removed

| File / config | Reason |
|---|---|
| `src/main/resources/application-postgres.properties` | Single target now, settings move to `application.properties` |
| `src/main/resources/db/postgres/` | Replaced by Flyway migrations under `db/migration/` |
| `petclinic-backend/docker-compose.yml` | Misleading; Docker path is gone |
| `application.properties`: `spring.sql.init.*` | Replaced by Flyway |

### Added

**Dependencies (`pom.xml`):**
```xml
<dependency>
  <groupId>org.flywaydb</groupId>
  <artifactId>flyway-core</artifactId>
</dependency>
<dependency>
  <groupId>org.flywaydb</groupId>
  <artifactId>flyway-database-postgresql</artifactId>
</dependency>
```
(Versions inherited from Spring Boot BOM.)

**`application.properties`** — single, simplified config:
```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/petclinic
spring.datasource.username=petclinic
spring.datasource.password=petclinic

spring.jpa.hibernate.ddl-auto=validate
spring.jpa.show-sql=true

spring.flyway.enabled=true
spring.flyway.locations=classpath:db/migration

# OpenAPI/Swagger UI
openapi.info.title=REST Petclinic backend API documentation
openapi.info.version=1.0
openapi.info.description=This is the REST API documentation of the Spring Petclinic backend.

logging.level.org.springframework=INFO
petclinic.security.enable=false
```

### Flyway Migrations (`src/main/resources/db/migration/`)

Narrative split — tells the story of how a real petclinic schema evolves.

**`V1__core_owners_pets.sql`** — "We started by tracking owners, their pets, and visits."
- `types` (pet types: cat, dog, …)
- `owners`
- `pets` (FK → types, FK → owners)
- `visits` (FK → pets)
- Relevant indexes from the original schema

**`V2__add_vets_and_security.sql`** — "Then we added vet records, specialties, and login."
- `vets`
- `specialties`
- `vet_specialties` (join)
- `users`
- `roles`
- Relevant indexes

**`V3__sample_data.sql`** — Test data seed (one-time, versioned). Same content as the existing `db/postgres/data.sql`.

**Reset semantics:** Because V3 is versioned (not repeatable), data is loaded once per fresh DB. To reset for a clean demo run, delete `petclinic-database/data/` (then `start-database.sh` re-bootstraps and the backend re-runs all migrations).

## Component 3: `.mcp.json` at `petclinic-clone/` Root

Project-scoped MCP config so any Claude Code session opened at the project root automatically sees the database tool.

```json
{
  "mcpServers": {
    "petclinic-db": {
      "command": "npx",
      "args": [
        "-y",
        "@bytebase/dbhub",
        "--transport", "stdio",
        "--dsn", "postgres://petclinic:petclinic@localhost:5432/petclinic"
      ]
    }
  }
}
```

Students need only Node (for `npx`); no global install required.

## Component 4: `start-database.sh`

```bash
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_DIR="$SCRIPT_DIR/petclinic-database"
JAR="$DB_DIR/target/petclinic-database.jar"

if [[ ! -f "$JAR" ]]; then
  echo "Building petclinic-database launcher..."
  (cd "$DB_DIR" && ./mvnw -q clean package)
fi

echo "🐘 Starting embedded Postgres on localhost:5432..."
echo "Data dir: $DB_DIR/data"
echo ""

cd "$DB_DIR"
exec java -jar "$JAR"
```

Mirrors the style of the existing `start-backend.sh` / `start-frontend.sh`.

## Workshop Flow (End-to-End)

```
Terminal 1: ./start-database.sh   → embedded Postgres on :5432
Terminal 2: ./start-backend.sh    → Spring Boot on :8080, Flyway runs V1/V2/V3
Terminal 3: ./start-frontend.sh   → Angular on :4200
Terminal 4: claude                → MCP auto-loaded; ask "show me all owners"
```

End-to-end test: open `http://localhost:4200`, browse owners. Then in Claude Code, "Câți owners sunt în baza de date și care are cele mai multe pets?" — dbhub queries the same Postgres, returns the answer.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Port 5432 conflict with locally installed Postgres | Document; suggest stopping local Postgres or changing the port in launcher + `application.properties` + `.mcp.json` |
| First-run binary download (~80MB) | One-time, cached under `~/.embedded-postgres-binaries`; warn students it may take 30s on first run |
| `data/` corruption between Postgres versions | Document: delete `petclinic-database/data/` to reset |
| `flyway-database-postgresql` missing → Flyway fails on PG 15+ | Explicit dep declared |
| Hibernate `ddl-auto=validate` fails on minor schema drift | Backend integration tests will catch this in CI; for workshop, students don't edit entities |

## Out of Scope

- CI/CD changes
- Frontend changes
- Production deployment (this is a workshop dev setup)
- Schema migrations beyond V1/V2/V3 (workshop content, not infra)
- Authentication of dbhub against the database (LAN-only, dev DB)

## Done Criteria

1. `petclinic-database/` is a buildable Maven project producing `target/petclinic-database.jar`.
2. `./start-database.sh` starts Postgres on 5432, persists in `petclinic-database/data/`.
3. `./start-backend.sh` starts cleanly: Flyway runs V1, V2, V3; Hibernate validates schema; app reaches "Started" log line.
4. `http://localhost:4200` loads, shows owners and pets.
5. From `claude` opened at `petclinic-clone/` root, the `petclinic-db` MCP server is listed and a query like "list all vets" returns rows.
6. No references to docker-compose remain in the repo (except possibly in archived docs/READMEs).
