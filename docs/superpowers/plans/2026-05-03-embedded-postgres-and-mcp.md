# Embedded Postgres + Flyway + MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dual H2/Docker-Postgres setup with a sibling `petclinic-database` Maven project that launches `io.zonky.test:embedded-postgres` on `localhost:5432`, plus Flyway-managed migrations in the backend, plus a project-root `.mcp.json` so dbhub can query the live database from Claude Code.

**Architecture:** Three-process workshop setup. (1) `petclinic-database` is an independent Maven project: a single `PostgresLauncher` main class downloads/launches a real Postgres binary, bootstraps the `petclinic` user+database on first run, then blocks. (2) `petclinic-backend` is reduced to a single connection target; Flyway owns the schema (V1 core domain, V2 vet+security, V3 sample data); Hibernate `ddl-auto=none`. (3) `.mcp.json` at the repo root wires dbhub via `npx`; opening Claude Code from `petclinic-clone/` auto-loads it.

**Tech Stack:** Java 21, Maven, Spring Boot 3.5.9, Flyway 10+ (`flyway-core` + `flyway-database-postgresql`), `io.zonky.test:embedded-postgres` 2.0.7, `embedded-postgres-binaries-bom` 16.2.0, `@bytebase/dbhub` (via npx).

**Key references:**
- Spec: `docs/superpowers/specs/2026-05-03-embedded-postgres-and-mcp-design.md`
- Existing schema: `petclinic-backend/src/main/resources/db/postgres/schema.sql` (will be split)
- Existing data: `petclinic-backend/src/main/resources/db/postgres/data.sql` (becomes V3)
- Hibernate entity-table mapping: confirmed via `@Table` annotations in `petclinic-backend/src/main/java/org/springframework/samples/petclinic/model/`

**Decision deviation from spec:** spec mentioned `ddl-auto=validate`. The existing schema uses `TEXT` columns while Hibernate would expect `varchar(255)` from String fields, so `validate` would fail without per-column overrides. Use **`ddl-auto=none`** instead — Flyway is the sole source of truth, Hibernate does no schema check at boot. Cleaner pattern for "Flyway owns the schema" anyway.

---

## Files Touched

**Create:**
- `petclinic-database/pom.xml`
- `petclinic-database/src/main/java/ro/victorrentea/petclinic/db/PostgresLauncher.java`
- `petclinic-database/src/test/java/ro/victorrentea/petclinic/db/PostgresLauncherBootstrapTest.java`
- `petclinic-database/.gitignore`
- `petclinic-backend/src/main/resources/db/migration/V1__core_owners_pets.sql`
- `petclinic-backend/src/main/resources/db/migration/V2__add_vets_and_security.sql`
- `petclinic-backend/src/main/resources/db/migration/V3__sample_data.sql`
- `.mcp.json` (repo root)
- `start-database.sh` (repo root)

**Modify:**
- `petclinic-backend/pom.xml` (remove h2, add flyway)
- `petclinic-backend/src/main/resources/application.properties` (single profile-free config)
- `.gitignore` (add `petclinic-database/data/`, `petclinic-database/target/`)

**Delete:**
- `petclinic-backend/src/main/resources/application-h2.properties`
- `petclinic-backend/src/main/resources/application-postgres.properties`
- `petclinic-backend/src/main/resources/db/h2/schema.sql`
- `petclinic-backend/src/main/resources/db/h2/data.sql`
- `petclinic-backend/src/main/resources/db/postgres/schema.sql`
- `petclinic-backend/src/main/resources/db/postgres/data.sql`
- `petclinic-backend/src/main/resources/db/postgres/petclinic_db_setup_postgres.txt`
- `petclinic-backend/docker-compose.yml`

---

## Task 1: Scaffold `petclinic-database` Maven project

**Files:**
- Create: `petclinic-database/pom.xml`
- Create: `petclinic-database/.gitignore`

- [ ] **Step 1: Create `petclinic-database/pom.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>ro.victorrentea.petclinic</groupId>
    <artifactId>petclinic-database</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>

    <description>Embedded Postgres launcher for the PetClinic workshop</description>

    <properties>
        <maven.compiler.source>21</maven.compiler.source>
        <maven.compiler.target>21</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <main.class>ro.victorrentea.petclinic.db.PostgresLauncher</main.class>
    </properties>

    <dependencyManagement>
        <dependencies>
            <dependency>
                <groupId>io.zonky.test.postgres</groupId>
                <artifactId>embedded-postgres-binaries-bom</artifactId>
                <version>16.2.0</version>
                <type>pom</type>
                <scope>import</scope>
            </dependency>
        </dependencies>
    </dependencyManagement>

    <dependencies>
        <dependency>
            <groupId>io.zonky.test</groupId>
            <artifactId>embedded-postgres</artifactId>
            <version>2.0.7</version>
        </dependency>

        <dependency>
            <groupId>org.junit.jupiter</groupId>
            <artifactId>junit-jupiter</artifactId>
            <version>5.10.2</version>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <finalName>petclinic-database</finalName>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-surefire-plugin</artifactId>
                <version>3.2.5</version>
            </plugin>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-shade-plugin</artifactId>
                <version>3.5.3</version>
                <executions>
                    <execution>
                        <phase>package</phase>
                        <goals><goal>shade</goal></goals>
                        <configuration>
                            <transformers>
                                <transformer implementation="org.apache.maven.plugins.shade.resource.ManifestResourceTransformer">
                                    <mainClass>${main.class}</mainClass>
                                </transformer>
                                <transformer implementation="org.apache.maven.plugins.shade.resource.ServicesResourceTransformer"/>
                            </transformers>
                            <filters>
                                <filter>
                                    <artifact>*:*</artifact>
                                    <excludes>
                                        <exclude>META-INF/*.SF</exclude>
                                        <exclude>META-INF/*.DSA</exclude>
                                        <exclude>META-INF/*.RSA</exclude>
                                    </excludes>
                                </filter>
                            </filters>
                        </configuration>
                    </execution>
                </executions>
            </plugin>
        </plugins>
    </build>
</project>
```

- [ ] **Step 2: Create `petclinic-database/.gitignore`**

```
target/
data/
```

- [ ] **Step 3: Verify the empty project builds**

Run from `~/workspace/petclinic-clone/petclinic-database`:
```
mvn -q -DskipTests package
```
Expected: BUILD SUCCESS, produces `target/petclinic-database.jar` (no main class yet — shade still runs but the manifest references a class that does not exist; the jar will fail at runtime, fine for now).

- [ ] **Step 4: Commit**

```bash
cd ~/workspace/petclinic-clone
git add petclinic-database/pom.xml petclinic-database/.gitignore
git commit -m "feat(database): scaffold petclinic-database Maven project"
```

---

## Task 2: Write failing test for the bootstrap step

**Files:**
- Create: `petclinic-database/src/test/java/ro/victorrentea/petclinic/db/PostgresLauncherBootstrapTest.java`

The bootstrap creates `petclinic` role + `petclinic` database. The test starts an embedded Postgres in a temp dir, calls `PostgresLauncher.bootstrap(pg)`, then connects as `petclinic`/`petclinic` to `petclinic` and runs `SELECT 1`.

- [ ] **Step 1: Write the failing test**

```java
package ro.victorrentea.petclinic.db;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PostgresLauncherBootstrapTest {

    @Test
    void bootstrap_creates_petclinic_role_and_database() throws Exception {
        try (EmbeddedPostgres pg = EmbeddedPostgres.builder().start()) {
            PostgresLauncher.bootstrap(pg);

            String url = "jdbc:postgresql://localhost:" + pg.getPort() + "/petclinic";
            try (Connection c = DriverManager.getConnection(url, "petclinic", "petclinic");
                 Statement s = c.createStatement();
                 ResultSet rs = s.executeQuery("SELECT current_user, current_database()")) {
                assertTrue(rs.next());
                assertEquals("petclinic", rs.getString(1));
                assertEquals("petclinic", rs.getString(2));
            }
        }
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

```
cd ~/workspace/petclinic-clone/petclinic-database
mvn -q test
```
Expected: compile FAIL — `PostgresLauncher` and method `bootstrap` not found.

---

## Task 3: Implement `PostgresLauncher.bootstrap` to make the test pass

**Files:**
- Create: `petclinic-database/src/main/java/ro/victorrentea/petclinic/db/PostgresLauncher.java`

- [ ] **Step 1: Implement the class with the bootstrap method**

```java
package ro.victorrentea.petclinic.db;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;

public class PostgresLauncher {

    static final String DB_USER = "petclinic";
    static final String DB_PASSWORD = "petclinic";
    static final String DB_NAME = "petclinic";

    public static void bootstrap(EmbeddedPostgres pg) throws Exception {
        DataSource superuser = pg.getPostgresDatabase();
        try (Connection c = superuser.getConnection();
             Statement s = c.createStatement()) {

            if (!roleExists(c, DB_USER)) {
                s.executeUpdate("CREATE USER " + DB_USER + " WITH PASSWORD '" + DB_PASSWORD + "'");
            }
            if (!databaseExists(c, DB_NAME)) {
                s.executeUpdate("CREATE DATABASE " + DB_NAME + " OWNER " + DB_USER);
                s.executeUpdate("GRANT ALL PRIVILEGES ON DATABASE " + DB_NAME + " TO " + DB_USER);
            }
        }
    }

    private static boolean roleExists(Connection c, String name) throws Exception {
        try (Statement s = c.createStatement();
             ResultSet rs = s.executeQuery("SELECT 1 FROM pg_roles WHERE rolname = '" + name + "'")) {
            return rs.next();
        }
    }

    private static boolean databaseExists(Connection c, String name) throws Exception {
        try (Statement s = c.createStatement();
             ResultSet rs = s.executeQuery("SELECT 1 FROM pg_database WHERE datname = '" + name + "'")) {
            return rs.next();
        }
    }
}
```

- [ ] **Step 2: Run test to verify it passes**

```
mvn -q test
```
Expected: PASS — `Tests run: 1, Failures: 0, Errors: 0`.

- [ ] **Step 3: Commit**

```bash
cd ~/workspace/petclinic-clone
git add petclinic-database/src
git commit -m "feat(database): bootstrap petclinic role and database on launch"
```

---

## Task 4: Implement `main` to launch Postgres on port 5432 and block

**Files:**
- Modify: `petclinic-database/src/main/java/ro/victorrentea/petclinic/db/PostgresLauncher.java`

The main method:
- starts Postgres on port 5432 with data dir `./data` (relative to current working directory)
- runs bootstrap once on a fresh cluster (skipped if `data/PG_VERSION` already exists)
- prints connection info
- blocks until interrupted

- [ ] **Step 1: Add `main` method and constants to `PostgresLauncher.java`**

Append inside the class (before the helpers, after `bootstrap`):

```java
    public static void main(String[] args) throws Exception {
        Path dataDir = Path.of("data").toAbsolutePath();
        boolean firstRun = !Files.exists(dataDir.resolve("PG_VERSION"));

        EmbeddedPostgres pg = EmbeddedPostgres.builder()
                .setPort(5432)
                .setDataDirectory(dataDir)
                .setCleanDataDirectory(false)
                .start();

        if (firstRun) {
            bootstrap(pg);
            System.out.println("Bootstrap complete: created role + database '" + DB_NAME + "'");
        }

        System.out.println("Postgres started:");
        System.out.println("  JDBC URL: jdbc:postgresql://localhost:" + pg.getPort()
                + "/" + DB_NAME + " (user: " + DB_USER + ", password: " + DB_PASSWORD + ")");
        System.out.println("  Data dir: " + dataDir);
        System.out.println("Press Ctrl+C to stop.");

        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            try { pg.close(); } catch (Exception ignored) {}
        }));

        Thread.currentThread().join();
    }
```

Add imports at the top:
```java
import java.nio.file.Files;
import java.nio.file.Path;
```

- [ ] **Step 2: Build the fat jar**

```
cd ~/workspace/petclinic-clone/petclinic-database
mvn -q -DskipTests package
```
Expected: BUILD SUCCESS, `target/petclinic-database.jar` exists.

- [ ] **Step 3: Run the jar manually and verify it starts Postgres**

In one terminal:
```
cd ~/workspace/petclinic-clone/petclinic-database
java -jar target/petclinic-database.jar
```
Expected output (first run, ~30s for binary download):
```
Bootstrap complete: created role + database 'petclinic'
Postgres started:
  JDBC URL: jdbc:postgresql://localhost:5432/petclinic (user: petclinic, password: petclinic)
  Data dir: /Users/.../petclinic-clone/petclinic-database/data
Press Ctrl+C to stop.
```

In a second terminal verify connectivity:
```
psql -h localhost -p 5432 -U petclinic -d petclinic -c 'SELECT current_database(), current_user'
```
(Password: `petclinic`. If `psql` is not installed: `nc -z localhost 5432 && echo OK`.)

Stop the launcher with Ctrl+C.

- [ ] **Step 4: Verify second run skips bootstrap**

```
java -jar target/petclinic-database.jar
```
Expected: NO "Bootstrap complete" line; Postgres restarts and prints JDBC URL using existing data dir. Stop with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
cd ~/workspace/petclinic-clone
git add petclinic-database/src
git commit -m "feat(database): main launcher with persistent data dir on port 5432"
```

---

## Task 5: Update root `.gitignore`

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Append to `.gitignore`**

```
# petclinic-database (embedded Postgres)
petclinic-database/target/
petclinic-database/data/
```

- [ ] **Step 2: Verify ignore works**

```
cd ~/workspace/petclinic-clone
git status --short
```
Expected: no `petclinic-database/target` or `petclinic-database/data` entries shown.

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: ignore petclinic-database build and data dirs"
```

---

## Task 6: Backend `pom.xml` — drop H2, add Flyway

**Files:**
- Modify: `petclinic-backend/pom.xml:66-70` (remove H2 block)
- Modify: `petclinic-backend/pom.xml` (insert Flyway deps adjacent to postgresql)

- [ ] **Step 1: Remove the H2 dependency block**

Delete lines:
```xml
        <dependency>
            <groupId>com.h2database</groupId>
            <artifactId>h2</artifactId>
            <scope>runtime</scope>
        </dependency>
```

- [ ] **Step 2: Add Flyway deps right after the postgresql dependency**

Insert immediately after the `org.postgresql:postgresql` block:
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

- [ ] **Step 3: Verify the project still compiles**

```
cd ~/workspace/petclinic-clone/petclinic-backend
./mvnw -q -DskipTests compile
```
Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit (do NOT yet run the app — config still references H2)**

```bash
cd ~/workspace/petclinic-clone
git add petclinic-backend/pom.xml
git commit -m "build(backend): drop H2, add flyway-core and flyway-database-postgresql"
```

---

## Task 7: Replace `application.properties` with the single profile-free config

**Files:**
- Modify: `petclinic-backend/src/main/resources/application.properties` (full rewrite)

- [ ] **Step 1: Replace file contents entirely**

```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/petclinic
spring.datasource.username=petclinic
spring.datasource.password=petclinic

# Hibernate: Flyway owns the schema
spring.jpa.hibernate.ddl-auto=none
spring.jpa.show-sql=true

# Flyway
spring.flyway.enabled=true
spring.flyway.locations=classpath:db/migration

# OpenAPI/Swagger UI
openapi.info.title=REST Petclinic backend API documentation
openapi.info.version=1.0
openapi.info.terms-of-service=https://github.com/spring-petclinic/petclinic-rest/blob/master/terms.txt
openapi.info.description=This is the REST API documentation of the Spring Petclinic backend. If authentication is enabled, use admin/admin when calling the APIs.

logging.level.org.springframework=INFO

# Authentication off by default
petclinic.security.enable=false
```

- [ ] **Step 2: Commit**

```bash
cd ~/workspace/petclinic-clone
git add petclinic-backend/src/main/resources/application.properties
git commit -m "config(backend): single profile-free application.properties for embedded Postgres"
```

---

## Task 8: Delete obsolete profile properties and DB folders

**Files:**
- Delete: `petclinic-backend/src/main/resources/application-h2.properties`
- Delete: `petclinic-backend/src/main/resources/application-postgres.properties`
- Delete: `petclinic-backend/src/main/resources/db/h2/` (entire folder)
- Delete: `petclinic-backend/src/main/resources/db/postgres/` (entire folder, including `petclinic_db_setup_postgres.txt`)
- Delete: `petclinic-backend/docker-compose.yml`

- [ ] **Step 1: Remove the files**

```bash
cd ~/workspace/petclinic-clone
git rm petclinic-backend/src/main/resources/application-h2.properties
git rm petclinic-backend/src/main/resources/application-postgres.properties
git rm -r petclinic-backend/src/main/resources/db/h2
git rm -r petclinic-backend/src/main/resources/db/postgres
git rm petclinic-backend/docker-compose.yml
```

- [ ] **Step 2: Verify the remaining `db/` directory is empty (will be repopulated next task)**

```
ls petclinic-backend/src/main/resources/db
```
Expected: empty (or `ls` reports nothing).

- [ ] **Step 3: Commit**

```bash
git commit -m "chore(backend): drop H2/Postgres-Docker scaffolding"
```

---

## Task 9: Flyway V1 — core owners/pets/visits

**Files:**
- Create: `petclinic-backend/src/main/resources/db/migration/V1__core_owners_pets.sql`

- [ ] **Step 1: Create the migration**

```sql
CREATE TABLE types (
    id   INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    name TEXT
);
CREATE INDEX ON types (name);

CREATE TABLE owners (
    id         INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    first_name TEXT,
    last_name  TEXT,
    address    TEXT,
    city       TEXT,
    telephone  TEXT
);
CREATE INDEX ON owners (last_name);

CREATE TABLE pets (
    id         INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    name       TEXT,
    birth_date DATE,
    type_id    INT NOT NULL REFERENCES types (id),
    owner_id   INT REFERENCES owners (id)
);
CREATE INDEX ON pets (name);
CREATE INDEX ON pets (owner_id);

CREATE TABLE visits (
    id          INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    pet_id      INT REFERENCES pets (id),
    visit_date  DATE,
    description TEXT
);
CREATE INDEX ON visits (pet_id);
```

- [ ] **Step 2: Commit**

```bash
cd ~/workspace/petclinic-clone
git add petclinic-backend/src/main/resources/db/migration/V1__core_owners_pets.sql
git commit -m "feat(backend): V1 migration — core owners/pets/visits"
```

---

## Task 10: Flyway V2 — vets and security

**Files:**
- Create: `petclinic-backend/src/main/resources/db/migration/V2__add_vets_and_security.sql`

- [ ] **Step 1: Create the migration**

```sql
CREATE TABLE vets (
    id         INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    first_name TEXT,
    last_name  TEXT
);
CREATE INDEX ON vets (last_name);

CREATE TABLE specialties (
    id   INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    name TEXT
);
CREATE INDEX ON specialties (name);

CREATE TABLE vet_specialties (
    vet_id       INT NOT NULL REFERENCES vets (id),
    specialty_id INT NOT NULL REFERENCES specialties (id),
    UNIQUE (vet_id, specialty_id)
);

CREATE TABLE users (
    username VARCHAR(20) NOT NULL,
    password VARCHAR(60) NOT NULL,
    enabled  BOOLEAN     NOT NULL DEFAULT TRUE,
    CONSTRAINT pk_users PRIMARY KEY (username)
);

CREATE TABLE roles (
    id       INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    username VARCHAR(20) NOT NULL,
    role     VARCHAR(20) NOT NULL,
    FOREIGN KEY (username) REFERENCES users (username),
    CONSTRAINT uni_username_role UNIQUE (role, username)
);
```

- [ ] **Step 2: Commit**

```bash
cd ~/workspace/petclinic-clone
git add petclinic-backend/src/main/resources/db/migration/V2__add_vets_and_security.sql
git commit -m "feat(backend): V2 migration — vets, specialties, users, roles"
```

---

## Task 11: Flyway V3 — sample data

**Files:**
- Create: `petclinic-backend/src/main/resources/db/migration/V3__sample_data.sql`

The plain `INSERT` statements (no `WHERE NOT EXISTS` guards) are safe because Flyway only applies V3 once on a fresh database.

- [ ] **Step 1: Create the migration**

```sql
INSERT INTO vets (first_name, last_name) VALUES
  ('James',  'Carter'),
  ('Helen',  'Leary'),
  ('Linda',  'Douglas'),
  ('Rafael', 'Ortega'),
  ('Henry',  'Stevens'),
  ('Sharon', 'Jenkins');

INSERT INTO specialties (name) VALUES ('radiology'), ('surgery'), ('dentistry');

INSERT INTO vet_specialties (vet_id, specialty_id) VALUES
  (1, 2), (2, 3), (3, 3), (2, 4), (1, 5);

INSERT INTO types (name) VALUES
  ('cat'), ('dog'), ('lizard'), ('snake'), ('bird'), ('hamster'), ('horse');

INSERT INTO owners (first_name, last_name, address, city, telephone) VALUES
  ('George',   'Franklin',  '110 W. Liberty St.',     'Madison',     '6085551023'),
  ('Betty',    'Davis',     '638 Cardinal Ave.',      'Sun Prairie', '6085551749'),
  ('Eduardo',  'Rodriquez', '2693 Commerce St.',      'McFarland',   '6085558763'),
  ('Harold',   'Davis',     '563 Friendly St.',       'Windsor',     '6085553198'),
  ('Peter',    'McTavish',  '2387 S. Fair Way',       'Madison',     '6085552765'),
  ('Jean',     'Coleman',   '105 N. Lake St.',        'Monona',      '6085552654'),
  ('Jeff',     'Black',     '1450 Oak Blvd.',         'Monona',      '6085555387'),
  ('Maria',    'Escobito',  '345 Maple St.',          'Madison',     '6085557683'),
  ('David',    'Schroeder', '2749 Blackhawk Trail',   'Madison',     '6085559435'),
  ('Carlos',   'Estaban',   '2335 Independence La.',  'Waunakee',    '6085555487'),
  ('Lydia',    'Quark',     '42 Kernel Way',          'Madison',     '6085559012'),
  ('Oscar',    'Byte',      '9 Cache Ct.',            'Monona',      '6085553344');

INSERT INTO pets (name, birth_date, type_id, owner_id) VALUES
  ('Leo',      DATE '2000-09-07', 1, 1),
  ('Basil',    DATE '2002-08-06', 6, 2),
  ('Rosy',     DATE '2001-04-17', 2, 3),
  ('Jewel',    DATE '2000-03-07', 2, 3),
  ('Iggy',     DATE '2000-11-30', 3, 4),
  ('George',   DATE '2000-01-20', 4, 5),
  ('Samantha', DATE '1995-09-04', 1, 6),
  ('Max',      DATE '1995-09-04', 1, 6),
  ('Lucky',    DATE '1999-08-06', 5, 7),
  ('Mulligan', DATE '1997-02-24', 2, 8),
  ('Freddy',   DATE '2000-03-09', 5, 9),
  ('Lucky',    DATE '2000-06-24', 2, 10),
  ('Sly',      DATE '2002-06-08', 1, 10);

INSERT INTO visits (pet_id, visit_date, description) VALUES
  (7, DATE '2010-03-04', 'rabies shot'),
  (8, DATE '2011-03-04', 'rabies shot'),
  (8, DATE '2009-06-04', 'neutered'),
  (7, DATE '2008-09-04', 'spayed');

INSERT INTO users (username, password, enabled) VALUES
  ('admin', '$2a$10$ymaklWBnpBKlgdMgkjWVF.GMGyvH8aDuTK.glFOaKw712LHtRRymS', TRUE);

INSERT INTO roles (username, role) VALUES
  ('admin', 'ROLE_OWNER_ADMIN'),
  ('admin', 'ROLE_VET_ADMIN'),
  ('admin', 'ROLE_ADMIN');
```

- [ ] **Step 2: Commit**

```bash
cd ~/workspace/petclinic-clone
git add petclinic-backend/src/main/resources/db/migration/V3__sample_data.sql
git commit -m "feat(backend): V3 migration — sample petclinic data"
```

---

## Task 12: Verify backend boots and Flyway applies all migrations

**Files (no edits, just verification):** —

This is the integration test for everything from Tasks 6–11.

- [ ] **Step 1: Reset the embedded Postgres data** (clean slate so V3 inserts succeed without conflict)

```bash
cd ~/workspace/petclinic-clone
rm -rf petclinic-database/data
```

- [ ] **Step 2: Start the database in one terminal**

```bash
cd ~/workspace/petclinic-clone/petclinic-database
java -jar target/petclinic-database.jar
```
Expected: "Bootstrap complete..." + "Postgres started: JDBC URL ...".

- [ ] **Step 3: In another terminal, start the backend**

```bash
cd ~/workspace/petclinic-clone/petclinic-backend
./mvnw -q spring-boot:run
```
Expected logs (key lines):
- `o.f.c.i.database.base.BaseDatabaseType : Database: jdbc:postgresql://localhost:5432/petclinic (PostgreSQL ...)`
- `o.f.core.internal.command.DbMigrate    : Migrating schema "public" to version "1 - core owners pets"`
- `o.f.core.internal.command.DbMigrate    : Migrating schema "public" to version "2 - add vets and security"`
- `o.f.core.internal.command.DbMigrate    : Migrating schema "public" to version "3 - sample data"`
- `o.f.core.internal.command.DbMigrate    : Successfully applied 3 migrations to schema "public"`
- `Started PetclinicBackendApplication in ... seconds`

- [ ] **Step 4: Verify the API returns data**

```bash
curl -s http://localhost:8080/api/owners | head -c 200
```
Expected: a JSON array starting with George Franklin.

- [ ] **Step 5: Stop both processes (Ctrl+C in each terminal). No code changes; nothing to commit.**

---

## Task 13: Create `.mcp.json` at repo root

**Files:**
- Create: `.mcp.json`

- [ ] **Step 1: Create the file**

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

- [ ] **Step 2: Commit**

```bash
cd ~/workspace/petclinic-clone
git add .mcp.json
git commit -m "feat: project-scoped MCP config wiring dbhub to embedded Postgres"
```

---

## Task 14: Create `start-database.sh`

**Files:**
- Create: `start-database.sh`

- [ ] **Step 1: Create the script**

```bash
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_DIR="$SCRIPT_DIR/petclinic-database"
JAR="$DB_DIR/target/petclinic-database.jar"

if [[ ! -f "$JAR" ]]; then
  echo "Building petclinic-database launcher..."
  (cd "$DB_DIR" && mvn -q -DskipTests package)
fi

echo "🐘 Starting embedded Postgres on localhost:5432..."
echo "Data dir: $DB_DIR/data"
echo ""

cd "$DB_DIR"
exec java -jar "$JAR"
```

- [ ] **Step 2: Make it executable and test it runs (then Ctrl+C)**

```bash
cd ~/workspace/petclinic-clone
chmod +x start-database.sh
./start-database.sh
```
Expected: same Postgres-started output as Task 4. Stop with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add start-database.sh
git commit -m "feat: start-database.sh — one-command embedded Postgres launcher"
```

---

## Task 15: End-to-end smoke test (3 terminals + Claude Code)

**Files (no edits, just verification):** —

- [ ] **Step 1: Terminal 1 — start the database**

```bash
cd ~/workspace/petclinic-clone
./start-database.sh
```
Wait for `Postgres started:` line.

- [ ] **Step 2: Terminal 2 — start the backend**

```bash
cd ~/workspace/petclinic-clone
./start-backend.sh
```
Wait for `Started PetclinicBackendApplication`. The 3 Flyway migrations should run on first boot of a fresh DB; on subsequent boots they're skipped (Flyway tracks state in `flyway_schema_history`).

- [ ] **Step 3: Terminal 3 — start the frontend**

```bash
cd ~/workspace/petclinic-clone
./start-frontend.sh
```
Wait for Angular dev server ready.

- [ ] **Step 4: Browser end-to-end check**

Open `http://localhost:4200` and confirm the Owners list loads with George Franklin, Betty Davis, etc.

- [ ] **Step 5: MCP check from Claude Code**

```bash
cd ~/workspace/petclinic-clone
claude
```
Inside Claude:
- Confirm the `petclinic-db` MCP server is listed (`/mcp` shows it as connected).
- Ask: "Folosind petclinic-db MCP, listează numele și prenumele tuturor owners din baza de date."
- Expected: dbhub returns 12 rows starting with George Franklin.

- [ ] **Step 6: Stop all 3 processes (Ctrl+C in each terminal). Nothing to commit.**

---

## Self-Review

**1. Spec coverage:**
- `petclinic-database/` independent Maven project — Task 1 ✓
- `PostgresLauncher` with bootstrap on first run — Tasks 2–4 ✓
- Persistent data dir at `petclinic-database/data/` — Task 4 ✓
- Backend connection updated to `localhost:5432` — Task 7 ✓
- Removed H2/Postgres profiles, db/h2, db/postgres, docker-compose — Task 8 ✓
- Flyway V1 (core owners/pets/visits) — Task 9 ✓
- Flyway V2 (vets + security) — Task 10 ✓
- Flyway V3 (sample data) — Task 11 ✓
- `.mcp.json` at root — Task 13 ✓
- `start-database.sh` at root — Task 14 ✓
- End-to-end demo flow — Task 15 ✓

**2. Placeholder scan:** None found. All steps contain concrete code, file paths, commands, and expected outputs.

**3. Type consistency:** `DB_USER`, `DB_PASSWORD`, `DB_NAME` constants used consistently in `PostgresLauncher.java` (Task 3 + Task 4). `petclinic` literal used everywhere else (.mcp.json, application.properties) — values match.

**4. Spec deviation logged:** `ddl-auto=none` instead of `validate` — explained at top of plan; safer with `TEXT` columns vs Hibernate's default `varchar(255)`.
