# PetClinic Guardrails

Automated checks against accidental drift, run **locally** in `.githooks/pre-commit` (+ `pre-push`), **remotely** in `.github/workflows/ci.yml`, or **socially** via `.github/CODEOWNERS`.

> **Principle — no hook without a CI backstop.** Every good hook must be backed by a
> continuous integration action that makes it **unavoidable**. Hooks are advisory: a
> developer can `--no-verify`, or never install them. CI is mandatory. So every action in
> `.githooks/` is mirrored in `ci.yml` — as the *same* regeneration+drift check (auto-fixable
> artifacts) or as a *fail-gate* (checks like gitleaks, Spotless, Spectral). The only
> deliberate exception is the `secrets.env` value scan, whose input file is gitignored and
> therefore exists only on the developer's machine.

## In place

### Backend architecture & contracts

| Guardrail | What it protects | How |
|---|---|---|
| `PackagesArchTest` | Logical architecture | ArchUnit asserts package deps adhere to `petclinic-backend/docs/packages.puml`, and that the diagram's package set matches the code's subpackages exactly |
| `C3ArchTest` | C4 architecture drift | Parses `docs/c4model.dsl` (stable, human C1/C2), which `!include`s `docs/c4model.c3.dsl` (code-coupled C3); asserts every code package maps to a component and component-to-component deps match the code; re-exports the `*.puml` C4 views |
| `DeploymentDiagramTest` | Deployment diagram drift | Reads the mxGraph XML embedded in `petclinic-backend/docs/deployment.drawio.png` (a real draw.io file: one artifact that both renders on GitHub and opens for editing in the desktop app) and compares its arrows against `petclinic-test/src/*.genseq.puml`, generated from real OpenTelemetry traces. Containers carry `traceParticipant="Browser|Backend|Chatbot|DB"`, arrows carry `traced="yes|no"`. Fails both ways — a traced arrow no trace shows, and a call the traces show that the picture does not draw — plus a third check that no arrow between two traced containers is left undeclared, so a new connection cannot opt out of the guardrail in silence |
| `ConceptualModelDiagramTest` | Conceptual model drift | Reads the mxGraph XML embedded in `petclinic-backend/docs/ConceptualModel.drawio.png` — the hand-arranged map of the domain, kept alongside the generated `DomainModel.puml` because a regenerated diagram cannot stay in the same place, and people navigate this one from memory. Boxes carry `concept="Owner"`, lines `assoc="Owner-Pet"`; cardinalities are checked against the **visible** end labels — a bare `*` at a many end, nothing at a to-one end — so the picture cannot pass while showing a marker it does not mean, and an unmarked end is asserted to really be to-one. Fails both ways on concepts and on links, rejects a line between two concepts that declares no `assoc`, and fails while any concept still sits untouched in the staging lane `docs/scripts/conceptual-model-patch.py` parked it in — layout is the one thing here a human owns |
| `OpenApiExtractorTest` | REST API contract | Regenerates `openapi.yaml` from the running app's API docs; the CI drift check fails if it differs from the committed file |
| `DomainModelExtractorTest` | Domain class diagram | Regenerates `docs/generated/DomainModel.puml` from the JPA annotations |
| `EndpointComplexityExtractorTest` | Where complexity actually sits | ASM reads `target/classes`: McCabe CC per method + the call graph from every entry point (`@RestController` handlers, `@McpTool`s, `@Scheduled` jobs, message listeners) down (lambdas included, abstract calls re-pointed at their implementations). Renders `docs/generated/endpoint-complexity.{html,json}`, endpoints ranked by the decision points of the *whole flow*. A report, not yet a fail-gate — no threshold is enforced |
| `JpaMatchesDBSchemaTest` | Entity ↔ migration drift | Test profile sets `ddl-auto=validate`; Hibernate fails context refresh if any `@Entity` column is missing from the Flyway-migrated schema |
| `DbSchemaExtractorTest` | DB schema snapshot | Boots Postgres, runs Flyway, dumps the schema to `petclinic-backend/DB.sql`; fails on drift |
| `DB.puml` ER diagram | DB schema review legibility | A sqlglot-based pre-commit generator (`petclinic-backend/docs/scripts/db/`) renders `docs/generated/DB.puml` from `petclinic-backend/DB.sql`, highlighting **this commit's** schema delta in red, and auto-stages it. pre-push blocks a `petclinic-backend/DB.sql` change whose pushed range lacks a regenerated diagram (catches `--no-verify`); **CI re-runs that same DB.sql↔DB.puml guard** so `git push --no-verify` can't bypass it |
| TS ↔ OpenAPI sync | Stale generated frontend types | `npm run generate:api` regenerates `api-types.ts` from `openapi.yaml` in pre-commit + CI; auto-staged / auto-committed on drift |
| `McpHttpSecurityTest`, `McpTomcatCustomizerTest` | MCP endpoint security | Assert the `/mcp` endpoint's authentication and Tomcat customization hold |

### Code quality

| Guardrail | What it protects | How |
|---|---|---|
| **SonarCloud Quality Gate** | Code-quality / new-code regressions | CI runs `SonarSource/sonarqube-scan-action` + `sonarqube-quality-gate-action` (config in `sonar-project.properties`). Java is analyzed with the custom **`petclinic agentic (extend)`** quality profile — it **extends** the built-in "Sonar agentic AI" and **overrides `java:S107`** ("too many parameters") to **max 5** params. The gate fails the build on new-code violations. |
| Build hygiene | Webpack & Javadoc warnings | `npm run build` fails on any webpack `Warning:` (`scripts/build-strict.sh`); CI runs `mvn javadoc:javadoc -Dmaven.javadoc.failOnError=true` |
| Spotless formatting | Java code-style drift | pre-commit runs `spotless:apply` on staged Java + re-stages; **CI runs `spotless:check`** as a fail-gate (Spotless has no lifecycle binding, so `mvn test` alone wouldn't catch it) |
| OpenAPI lint (Spectral) | API-spec style/quality | pre-push **and CI** run `npm run lint:openapi` against `.config/spectral.yaml` over the freshly extracted `openapi.yaml` |

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
| Unversioned-dependency surface | Silent BOM-managed deps going unreviewed | `scripts/list-unversioned-deps.py` collapses every dependency declared with **no** `<version>` (version inherited from a parent/BOM) into `petclinic-backend/pom-libs.txt`. pre-commit regenerates + stages it when a pom changes; pre-push **and** CI fail on drift; CODEOWNERS routes its changes to the elders |
| `gitleaks` | Secrets in commits | pre-commit blocks commits with detected secrets; **CI re-scans the pushed commits with gitleaks** (range-scoped, like the hook's staged-diff scan) so `--no-verify` can't slip a secret past review |
| CODEOWNERS Elders review | Sensitive files | `@victorrentea/elders` review required for `.github/CODEOWNERS`, `.claude/settings.json`, `openapi.yaml`, `petclinic-backend/DB.sql`, `db/migration/`, `docs/packages.puml`, `docs/c4model.dsl`, `docs/c4model.c3.dsl`, `docs/generated/DomainModel.puml`, `**/pom.xml`, `petclinic-frontend/package.json`, `petclinic-backend/pom-libs.txt`, `.github/workflows/ci.yml` |
| `.claude/settings.json` ask | Local AI edits to sensitive files | Prompts Claude before Edit/Write of the CODEOWNERS-protected paths |
| Pre-commit / pre-push hooks (enable once: `git config core.hooksPath .githooks`) | Local drift detection | pre-commit: `gitleaks`, Spotless apply, TS/DB.puml/unversioned-deps regen + stage. pre-push: guardrail tests, Spectral lint, `ng build`, and all drift/`--check` gates |
| CI workflow (`ci.yml`) | Push/PR drift detection (the hook backstop) | Mirrors every hook action so `--no-verify` can't bypass them: `gitleaks detect`, `spotless:check`, the DB.sql↔DB.puml guard, `mvn test` + Javadoc, Spectral lint, strict frontend build, the unversioned-deps regen, and SonarCloud scan/gate. Auto-commits regenerated artifacts with `[skip ci]`; fork PRs fail with an actionable error |

## Considered, not scheduled

- **Test coverage floor** — JaCoCo per-package thresholds for `rest/`, `mapper/`, `repository/`. (SonarCloud's quality gate already enforces coverage on *new* code.)
- **Endpoint / capability allow-list** — ArchUnit forbidding `@RequestMapping` outside `rest/` and `Runtime.exec` / `System.getenv` outside an allow-list.
- **Logging / observability invariants** — every REST method logs entry+exit; no log line carries PII.
- **Performance / N+1 drift** — SQL-statement-count smoke tests on hot endpoints.
- **Spring `@ConfigurationProperties` / `@Value` strict mode** — no off-the-shelf build-time check; ad-hoc rules are fragile.
