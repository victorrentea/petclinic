# PetClinic Guardrails

Automated checks against accidental drift, run **locally** in `.githooks/pre-commit` (+ `pre-push`), **remotely** in `.github/workflows/ci.yml`, or **socially** via `.github/CODEOWNERS`.

## In place

### Backend architecture & contracts

| Guardrail | What it protects | How |
|---|---|---|
| `PackagesArchTest` | Logical architecture | ArchUnit asserts package deps adhere to `petclinic-backend/docs/packages.puml`, and that the diagram's package set matches the code's subpackages exactly |
| `C3ArchTest` | C4 architecture drift | Parses hand-written `docs/c4model.dsl`; asserts every code package maps to a component and component-to-component deps match the code; re-exports the `*.puml` C4 views |
| `OpenApiExtractorTest` | REST API contract | Regenerates `openapi.yaml` from the running app's API docs; the CI drift check fails if it differs from the committed file |
| `DomainModelExtractorTest` | Domain class diagram | Regenerates `docs/generated/DomainModel.puml` from the JPA annotations |
| `JpaMatchesDBSchemaTest` | Entity ↔ migration drift | Test profile sets `ddl-auto=validate`; Hibernate fails context refresh if any `@Entity` column is missing from the Flyway-migrated schema |
| `DbSchemaExtractorTest` | DB schema snapshot | Boots Postgres, runs Flyway, dumps the schema to `DB.sql`; fails on drift |
| `DbSchema.puml` ER diagram | DB schema review legibility | A sqlglot-based pre-commit generator (`petclinic-backend/docs/scripts/`) renders `docs/generated/DbSchema.puml` from `DB.sql`, highlighting **this commit's** schema delta in red, and auto-stages it. pre-push blocks a `DB.sql` change whose pushed range lacks a regenerated diagram (catches `--no-verify`) |
| TS ↔ OpenAPI sync | Stale generated frontend types | `npm run generate:api` regenerates `api-types.ts` from `openapi.yaml` in pre-commit + CI; auto-staged / auto-committed on drift |
| `McpHttpSecurityTest`, `McpTomcatCustomizerTest` | MCP endpoint security | Assert the `/mcp` endpoint's authentication and Tomcat customization hold |

### Code quality

| Guardrail | What it protects | How |
|---|---|---|
| **SonarCloud Quality Gate** | Code-quality / new-code regressions | CI runs `SonarSource/sonarqube-scan-action` + `sonarqube-quality-gate-action` (config in `sonar-project.properties`). Java is analyzed with the custom **`petclinic agentic (extend)`** quality profile — it **extends** the built-in "Sonar agentic AI" and **overrides `java:S107`** ("too many parameters") to **max 5** params. The gate fails the build on new-code violations. |
| Build hygiene | Webpack & Javadoc warnings | `npm run build` fails on any webpack `Warning:` (`scripts/build-strict.sh`); CI runs `mvn javadoc:javadoc -Dmaven.javadoc.failOnError=true` |

### Chatbot (Embabel agents + assistant)

| Guardrail | What it protects | How |
|---|---|---|
| `FirefighterGuard` (+ `FirefighterGuardTest`) | Runaway agent restarts | Hard, code-level caps — restart order DB→BE→FE→OTEL, max 2 per service, escalate after 3 total — enforced regardless of what the LLM/planner picks |
| `JudgeGuard` (+ `JudgeGuardTest`) | Off-topic / unsafe assistant I/O | An LLM judge vets every inbound message **and** the produced reply; UNSAFE short-circuits to a refusal |
| `AgentStateDiagramTest` | Agent-graph diagram drift | Regenerates `docs/diagrams/*.puml` for each `@Agent` by reflection over the `@Action` signatures (offline, deterministic) and asserts the rendered graph |

### Process

| Guardrail | What it protects | How |
|---|---|---|
| Dependency discipline | Drive-by upgrades / known CVEs | Dependabot opens weekly batched (minor+patch) PRs per ecosystem; CVEs surface as Dependabot security alerts |
| `gitleaks` (pre-commit) | Secrets in commits | Blocks commits containing detected secrets |
| CODEOWNERS Elders review | Sensitive files | `@victorrentea/elders` review required for `.github/CODEOWNERS`, `.claude/settings.json`, `openapi.yaml`, `DB.sql`, `db/migration/`, `docs/packages.puml`, `docs/c4model.dsl`, `docs/generated/DomainModel.puml`, `**/pom.xml`, `petclinic-frontend/package.json`, `.github/workflows/ci.yml` |
| `.claude/settings.json` ask | Local AI edits to sensitive files | Prompts Claude before Edit/Write of the CODEOWNERS-protected paths |
| Pre-commit / pre-push hooks | Pre-push drift detection | Run `gitleaks`, the guardrail tests, and the TS regen; auto-stage regenerated artifacts |
| CI workflow (`ci.yml`) | Push/PR drift detection | Runs `mvn test` + Javadoc + strict frontend build + SonarCloud scan/gate. Auto-commits regenerated artifacts with `[skip ci]`; fork PRs fail with an actionable error |

## Considered, not scheduled

- **Test coverage floor** — JaCoCo per-package thresholds for `rest/`, `mapper/`, `repository/`. (SonarCloud's quality gate already enforces coverage on *new* code.)
- **Endpoint / capability allow-list** — ArchUnit forbidding `@RequestMapping` outside `rest/` and `Runtime.exec` / `System.getenv` outside an allow-list.
- **Logging / observability invariants** — every REST method logs entry+exit; no log line carries PII.
- **Performance / N+1 drift** — SQL-statement-count smoke tests on hot endpoints.
- **Spring `@ConfigurationProperties` / `@Value` strict mode** — no off-the-shelf build-time check; ad-hoc rules are fragile.
