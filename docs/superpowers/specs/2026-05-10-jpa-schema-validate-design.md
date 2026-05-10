# Guardrail A: JPA Schema-Validate — Design

**Date:** 2026-05-10
**Status:** Approved for planning

## Goal

Catch entity ↔ migration drift at boot time. Specifically: if a developer (human or AI) adds a `@Column` to a JPA entity without writing the corresponding Flyway migration, the test suite fails fast with a clear "column not found" message — instead of leaking out as a runtime SQL error in production or a noisy unrelated test failure.

## Mechanism

Set `spring.jpa.hibernate.ddl-auto=validate` for the test classpath only. With Flyway running first to apply migrations, then Hibernate validating the resulting schema against the `@Entity` model on every Spring context refresh, any new entity field that lacks a column in the migrated schema makes context refresh throw — and any `@SpringBootTest` fails at boot.

## Files

- **Modify** `petclinic-backend/src/test/resources/application-test.properties` — append:
  ```properties
  spring.jpa.hibernate.ddl-auto=validate
  ```
  Loaded only when the "test" Spring profile is active. Profile-overlay over main `application.properties` (which keeps `ddl-auto=none`); production unaffected. Note: `src/test/resources/application.properties` would *replace* (not overlay) main's file, which would silently drop `petclinic.security.enable=false`, the OpenAPI metadata, etc. — hence the profile-overlay approach.

- **Add** `petclinic-backend/src/test/java/victor/training/petclinic/guardrail/JpaSchemaValidateTest.java` — a sentinel test annotated `@AutoConfigureMockMvc + @SpringBootTest + @AutoConfigureEmbeddedDatabase(ZONKY) + @ActiveProfiles("test")`. The annotation set is intentionally identical to `OpenApiSyncTest` (which is also updated to add `@ActiveProfiles("test")`) so Spring's TestContext cache shares a single ApplicationContext between the two tests. Body is empty: the assertion is "context loads".

- **Modify** `petclinic-backend/src/test/java/victor/training/petclinic/guardrail/OpenApiSyncTest.java` — add `@ActiveProfiles("test")` so the cache stays shared with the new test.

- **Modify** `.githooks/pre-commit` to include `JpaSchemaValidateTest` in the `-Dtest=...` selector. Cost is ~0s after `OpenApiSyncTest` boots because of context cache reuse.

- **Modify** `GUARDRAILS.md` to move guardrail A from 🚧 to ✅.

## What it catches

- ✅ Adding a `@Column` to an entity without a matching migration.
- ✅ Adding a new `@Entity` whose `@Table` is not created by any migration.
- ⚠️ Column type mismatches — Hibernate validates type families but is lax on exact precision and varchar length.
- ⚠️ Nullability mismatches — Hibernate is famously lax on `@NotNull` vs `NOT NULL`.
- ❌ Removing an entity field that the database still has — Hibernate validate is one-directional. The existing `DbSchemaSyncTest` covers the migration-vs-snapshot direction.

These caveats go into the test's javadoc.

## Side effect

Because the `ddl-auto=validate` override applies globally to the test classpath, every existing `@SpringBootTest` (not just `JpaSchemaValidateTest`) now also fails fast on schema drift. The new test is primarily a named sentinel for documentation and pre-commit selection.

## Non-goals

- Validating the reverse direction (DB columns without entity fields) — that is `DbSchemaSyncTest`'s job, partially.
- Validating `@Index`, `@UniqueConstraint`, foreign keys, or any other schema feature beyond column-existence.
- Catching production startup failures — production keeps `ddl-auto=none` to avoid surprising operators on hot deploys.
