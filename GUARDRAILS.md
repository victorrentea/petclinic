# PetClinic Guardrails

Automated checks against accidental drift, run **locally** in `.githooks/pre-commit`, **remotely** in `.github/workflows/ci-guardrails.yml`, or **socially** via `.github/CODEOWNERS`.

## In place

| Guardrail | What it protects | How |
|---|---|---|
| `PackagesArchUnitTest` | Logical architecture | ArchUnit asserts package deps match `petclinic-backend/docs/packages.puml` |
| `OpenApiSyncTest` | REST API contract | Diffs live `/v3/api-docs.yaml` against committed `openapi.yaml` |
| `JpaSchemaValidateTest` | Entity ↔ migration drift | Test profile sets `ddl-auto=validate`; Hibernate fails context refresh on schema mismatch |
| `DbSchemaSyncTest` | DB schema | Boots Postgres, runs Flyway, dumps to `db.sql`; fails on drift |
| TS ↔ OpenAPI sync | Stale generated frontend types | `npm run generate:api` runs in pre-commit + CI; `api-types.ts` auto-staged / auto-committed on drift |
| `C4ModelExtractorTest` | C4 architecture diagrams | Regenerates `docs/generated/C4.dsl` + per-view `*.puml` from code |
| `DomainModelExtractorTest` | Domain class diagram | Regenerates `docs/generated/DomainModel.puml` from JPA annotations |
| Build hygiene | Webpack & Javadoc warnings | `npm run build` fails on any webpack `Warning:` (custom-webpack + `scripts/build-strict.sh`); CI runs `mvn javadoc:javadoc -Dmaven.javadoc.failOnError=true` |
| Dependency discipline | Drive-by upgrades / known CVEs | Dependabot opens weekly batched (minor+patch) PRs per ecosystem; CVEs surface as Dependabot security alerts |
| `gitleaks` (pre-commit) | Secrets in commits | Blocks commits containing detected secrets |
| CODEOWNERS Elders review | Sensitive files | `@victorrentea/elders` review for `.claude/settings*.json`, `.github/CODEOWNERS`, `openapi.yaml`, `ci-guardrails.yml`, `**/pom.xml`, `petclinic-frontend/package.json`, `petclinic-backend/docs/packages.puml` |
| `.claude/settings.json` ask | Local AI edits to sensitive files | Prompts Claude before Edit/Write of the CODEOWNERS-protected paths |
| Pre-commit hook | Pre-push drift detection | Runs `gitleaks`, the guardrail tests, and the TS regen; auto-stages regenerated artifacts |
| CI workflow | Push/PR drift detection | Runs `./mvnw test` + Javadoc + strict frontend build. Auto-commits regenerated artifacts with `[skip ci]`; fork PRs fail with actionable error |

## Considered, not scheduled

- **Test coverage floor** — JaCoCo per-package thresholds for `rest/`, `mapper/`, `repository/`.
- **Endpoint / capability allow-list** — ArchUnit forbidding `@RequestMapping` outside `rest/` and `Runtime.exec` / `System.getenv` outside an allow-list.
- **Logging / observability invariants** — every REST method logs entry+exit; no log line carries PII.
- **Performance / N+1 drift** — SQL-statement-count smoke tests on hot endpoints.
- **Spring `@ConfigurationProperties` / `@Value` strict mode** — no off-the-shelf build-time check; ad-hoc rules are fragile.
