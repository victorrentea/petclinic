# Guardrail A: JPA Schema-Validate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Hibernate-`validate` schema guardrail that fails any `@SpringBootTest` if entity-to-migration drift exists.

**Architecture:** Test-classpath-only `application.properties` overrides `ddl-auto` to `validate`. A named sentinel test makes the invariant visible and gets included in the pre-commit hook. No production-config change.

**Tech Stack:** Spring Boot test, Flyway, Zonky embedded Postgres — all already in the project.

---

## Task 1: Test-classpath ddl-auto=validate override

**Files:**
- Create: `petclinic-backend/src/test/resources/application.properties`

- [ ] **Step 1: Create the override file**

Write `petclinic-backend/src/test/resources/application.properties` with exactly:

```properties
# Test classpath only — fail fast on entity ↔ migration drift.
# Production retains ddl-auto=none in src/main/resources/application.properties.
spring.jpa.hibernate.ddl-auto=validate
```

- [ ] **Step 2: Verify**

Run:
```bash
cat petclinic-backend/src/test/resources/application.properties
```
Expected: file contains the three lines above.

---

## Task 2: Sentinel test

**Files:**
- Create: `petclinic-backend/src/test/java/victor/training/petclinic/guardrail/JpaSchemaValidateTest.java`

- [ ] **Step 1: Write the test**

Create `petclinic-backend/src/test/java/victor/training/petclinic/guardrail/JpaSchemaValidateTest.java` with exactly:

```java
package victor.training.petclinic.guardrail;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;

/**
 * Schema sync guardrail. With ddl-auto=validate (set in
 * src/test/resources/application.properties), Spring context refresh
 * throws if any @Entity column does not exist in the Flyway-migrated
 * schema.
 *
 * Annotation set is intentionally identical to OpenApiSyncTest so that
 * Spring's TestContext cache reuses the same ApplicationContext between
 * the two tests.
 *
 * Caveats: Hibernate validate is one-directional (entity → DB). It is
 * lax on column precision, varchar length, and nullability. The reverse
 * direction (DB column without entity field) is partially covered by
 * DbSchemaSyncTest.
 */
@AutoConfigureMockMvc
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
class JpaSchemaValidateTest {

    @Test
    void contextLoads_meaningSchemaMatchesEntities() {
        // Empty body. The assertion is that the Spring context loads at all.
    }
}
```

- [ ] **Step 2: Run it from a clean target to confirm pass**

Run:
```bash
cd petclinic-backend && ./mvnw -q clean test -Dtest=JpaSchemaValidateTest
```
Expected: BUILD SUCCESS, "Tests run: 1, Failures: 0".

- [ ] **Step 3: Sanity-check that ddl-auto override is loaded**

Run:
```bash
cd petclinic-backend && ./mvnw -q test -Dtest=JpaSchemaValidateTest 2>&1 | grep -i "ddl-auto\|HHH" | head -5
```
The presence of any Hibernate (HHH...) startup messages confirms validation ran. The test passing in Step 2 already proves it.

---

## Task 3: Add to pre-commit hook

**Files:**
- Modify: `.githooks/pre-commit:22`

- [ ] **Step 1: Add JpaSchemaValidateTest to the -Dtest= selector**

Open `.githooks/pre-commit`. Find the line:
```
mvn -q test -Dtest=C4ModelExtractorTest,DomainModelExtractorTest,DomainModelDiagramExtractorTest,OpenApiSyncTest
```

Replace with:
```
mvn -q test -Dtest=C4ModelExtractorTest,DomainModelExtractorTest,DomainModelDiagramExtractorTest,OpenApiSyncTest,JpaSchemaValidateTest
```

- [ ] **Step 2: Verify pre-commit selector**

Run:
```bash
grep -n "JpaSchemaValidateTest" .githooks/pre-commit
```
Expected: one line, the `mvn -q test -Dtest=...` line, includes the new test name.

- [ ] **Step 3: Dry-run the hook**

Stage a no-op edit to anything (e.g., a whitespace touch on this plan file) and observe the hook running. The output should mention OpenApiSyncTest and JpaSchemaValidateTest both running. Then unstage.

This step is optional — the next real commit will exercise the hook.

---

## Task 4: Update GUARDRAILS.md

**Files:**
- Modify: `GUARDRAILS.md`

- [ ] **Step 1: Move guardrail A from 🚧 to ✅**

In `GUARDRAILS.md`, delete the row whose first cell is `**A**` from the "🚧 Planned" table.

In the "✅ In place" table, insert a new row (after `OpenApiSyncTest` is fine) with these three cells:

- `**`JpaSchemaValidateTest`**`
- `Entity ↔ migration drift`
- `Test classpath sets `spring.jpa.hibernate.ddl-auto=validate`; Hibernate fails context refresh if any `@Entity` column is missing from the Flyway-migrated schema. Sentinel test in `guardrail/` shares Spring context cache with `OpenApiSyncTest`.`

- [ ] **Step 2: Verify**

Run:
```bash
grep -A1 JpaSchemaValidate GUARDRAILS.md && echo --- && grep -c "🚧 Planned" GUARDRAILS.md
```
Expected: row is in the in-place table; the planned-table heading still exists once.

---

## Task 5: Commit and push

**Files:**
- Stage: all of the above

- [ ] **Step 1: Commit**

```bash
git add petclinic-backend/src/test/resources/application.properties \
        petclinic-backend/src/test/java/victor/training/petclinic/guardrail/JpaSchemaValidateTest.java \
        .githooks/pre-commit \
        GUARDRAILS.md
git commit -m "feat(guardrail): JPA schema-validate via test-classpath ddl-auto=validate"
```

The pre-commit hook will run the full guardrail-test set including the new test. Pass is required.

- [ ] **Step 2: Rebase + push**

```bash
git pull --rebase origin main && git push origin main
```

CI will then run the full `./mvnw test` suite; all `@SpringBootTest`s now run with `validate`. Any pre-existing schema drift would surface in CI even if not in pre-commit.

---

## Self-review notes

**Spec coverage:**
- Test-classpath override → Task 1
- Sentinel test with cache-shared annotations → Task 2
- Pre-commit inclusion → Task 3
- GUARDRAILS.md status update → Task 4
- Commit/push → Task 5

**Placeholder scan:** none. All steps have exact content/commands.

**Type consistency:** `JpaSchemaValidateTest` name appears identical in test file, pre-commit hook, GUARDRAILS.md row, and commit-staging command.
