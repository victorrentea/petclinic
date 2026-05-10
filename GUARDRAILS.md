# PetClinic Guardrails

A catalog of automated checks that defend the project against accidental drift — whether human or AI introduced. Each guardrail is enforced **locally** in the pre-commit hook, **remotely** in CI (`.github/workflows/ci-guardrails.yml`), or **socially** via CODEOWNERS review.

Legend: ✅ in place · 🚧 planned · 💡 considered, not scheduled

---

## ✅ In place

| Guardrail | What it protects | How |
|---|---|---|
| **`PackagesArchUnitTest`** | Logical architecture | ArchUnit asserts package dependencies match `petclinic-backend/docs/packages.puml`; bidirectional check that diagram packages = code subpackages |
| **`OpenApiSyncTest`** | REST API contract | Boots app, diffs `/v3/api-docs.yaml` against the committed `openapi.yaml` at repo root |
| **`JpaSchemaValidateTest`** | Entity ↔ migration drift | Activates "test" profile → `application-test.properties` sets `spring.jpa.hibernate.ddl-auto=validate` → Hibernate fails Spring context refresh if any `@Entity` column is missing from the Flyway-migrated schema. Sentinel test in `guardrail/` shares Spring TestContext cache with `OpenApiSyncTest` (both annotated `@ActiveProfiles("test")`) |
| **TS ↔ OpenAPI sync** | Frontend stale generated types | Pre-commit and CI both run `npm run generate:api`; resulting `petclinic-frontend/src/app/generated/api-types.ts` is auto-staged locally and auto-committed by CI on drift, matching the C4/db.sql pattern |
| **`DbSchemaSyncTest`** | Database schema | Boots embedded Postgres, runs Flyway migrations, dumps schema with `pg_dump` to `db.sql`; commit-blocked if drift |
| **`C4ModelExtractorTest`** | C4 architecture documentation | Regenerates `docs/generated/C4.dsl` + per-view `*.puml` from code; CI auto-commits any drift |
| **`DomainModelExtractorTest`** | Domain model documentation | Regenerates `docs/generated/DomainModel.puml` from JPA annotations |
| **CODEOWNERS Elders review** | Sensitive files | `@victorrentea/elders` review required for `.claude/settings*.json`, `.github/CODEOWNERS`, `openapi.yaml`, `.github/workflows/ci-guardrails.yml`, `**/pom.xml`, `petclinic-frontend/package.json`, `petclinic-backend/docs/packages.puml` |
| **`.claude/settings.json` ask-permissions** | Local AI guardrails | Prompts before Claude can Edit/Write the same sensitive paths covered by CODEOWNERS |
| **gitleaks** (pre-commit) | Secrets in commits | `gitleaks protect --staged` blocks commits containing detected secrets |
| **Pre-commit hook** (`.githooks/pre-commit`) | Drift detection before push | Runs the diagram extractors and `OpenApiSyncTest`, stages regenerated artifacts |
| **CI guardrail workflow** (`.github/workflows/ci-guardrails.yml`) | Drift detection on push/PR | Runs `./mvnw test` (full suite incl. all guardrail tests). Auto-commits regenerated `docs/generated/` and `db.sql` with `[skip ci]`; fork PRs fail with actionable message |

---

## 🚧 Planned (in scope for the current guardrails initiative)

| # | Guardrail | What it protects | Approach |
|---|---|---|---|
| **C** | Build-hygiene fail-on-warnings | Silent quality regression | Treat any frontend "Compiled with problems" as an error; fail Maven on Javadoc errors and Spring config-properties metadata mismatches |
| **D** | Dependency upgrade discipline | Drive-by upgrades / supply-chain risk | Renovate (or Dependabot) with batched weekly minor-upgrade PRs; OWASP/Snyk dependency-check workflow surfacing known CVEs (informational, not blocking initially) |

---

## 💡 Considered, not scheduled

These were on the table during the same brainstorm but parked for later:

- **Test coverage floor.** JaCoCo rule keeping `rest/`, `mapper/`, `repository/` coverage above a minimum and forbidding drops greater than a few points commit-to-commit.
- **Endpoint and capability allow-list.** ArchUnit rule disallowing `@RequestMapping`/`@GetMapping` outside `rest/`, and forbidding `Runtime.exec` / `System.getenv` outside an explicit allow-list.
- **Logging / observability invariants.** Each REST controller method logs entry+exit (or is wrapped by an aspect that does); no log line includes user PII.
- **Performance / N+1 drift.** Smoke tests asserting SQL statement counts under a threshold for high-traffic endpoints.

---

_Maintenance: when a 🚧 row lands, move it to the ✅ table with a one-line "How". When a 💡 item is scheduled, move it to 🚧 and add an approach._
