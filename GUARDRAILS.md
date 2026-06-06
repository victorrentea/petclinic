# PetClinic Guardrails

Automated checks against accidental drift, run **locally** in `.githooks/`,
**remotely** in CI, or **socially** via `.github/CODEOWNERS`.

## In place

| Guardrail | What it protects | How |
|---|---|---|
| Schema / entity sync (`test/guardrails/schema-sync.spec.ts`) | Entity ↔ migration drift | Offline check: collects every TypeORM `@Entity`/`@Column`/`@JoinColumn`/`@JoinTable` from `getMetadataArgsStorage()` (decorator side-effects, **no DB connection**) and cross-checks the resulting table/column **names** against the `CREATE TABLE` statements in the committed migrations under `src/migrations/`. Fails on entity-only tables/columns and on migrated tables/columns with no owning entity. Run with `npm run guardrail:schema`. |
| OpenAPI sync (`test/guardrails/openapi-sync.ts` + `openapi-document.ts`) | REST API contract | Boots the real `AppModule` offline (TypeORM connection neutralized — Swagger only needs controllers + DTO `@ApiProperty` metadata, no Postgres) and runs `SwaggerModule.createDocument` exactly as `src/main.ts` does. `npm run guardrail:openapi:generate` (re)writes the committed `openapi.yaml`; `npm run guardrail:openapi` diffs the live document against it and exits non-zero on drift. |
| TS ↔ OpenAPI sync | Stale generated TS models | Both modules generate their TS models from the root `openapi.yaml` via `npm run generate:api` (`openapi-typescript`, wired as `prebuild` on each side): frontend → `src/app/generated/api-types.ts`, backend → `src/generated/api-types.ts`. The pre-commit hook regenerates / auto-stages both whenever `openapi.yaml` is staged. |
| DTO ↔ contract lock (`src/common/contract.ts` + `test/guardrails/dto-contract.spec.ts`) | Backend DTOs drifting from the contract | The root `openapi.yaml` is the source of truth for DTO shapes. Every backend DTO class carries a compile-time assertion `true satisfies Exact<XDto, components['schemas']['XDto']>` against the generated `src/generated/api-types.ts` — an extra, missing or differently-typed field fails `tsc`, which the pre-commit hook runs on both modules. `dto-contract.spec.ts` asserts every `*Dto` schema is locked. |
| `gitleaks` (pre-commit) | Secrets in commits | Blocks commits containing detected secrets; a custom `secrets.env` value scan runs alongside it. |
| Date-column type (`test/guardrails/date-column-type.ts`) | `date` columns typed `string` | Parses staged backend sources with the TypeScript compiler API (real AST, no regex) and blocks the commit if an `@Entity` class property whose `@Column` declares `type: 'date'` (or `@Column('date')`) is typed `string` — it must be `Date`. Runs in `.githooks/pre-commit` on the **staged** content (`git show :file`); unit-tested in `date-column-type.spec.ts` (picked up by `npm run guardrail:schema`). |
| CODEOWNERS review | Sensitive files | `@victorrentea/elders` review required for contract & config files such as `openapi.yaml`, `.claude/settings*.json`, `.github/CODEOWNERS`, the CI workflow, and `petclinic-frontend/package.json`. |
| Package dependency diagram (`test/guardrails/package-deps.ts`) | Cross-package import drift | Scans all `src/**/*.ts` files, extracts relative imports, and builds a cross-package dependency graph. `npm run guardrail:package-deps` regenerates `docs/packages.puml` from actual imports; the pre-commit hook blocks commits to `src/` if the committed diagram is out of sync with the current code. View `docs/packages.puml` in any PlantUML renderer (e.g. IntelliJ plugin, plantuml.com). |
| Pre-commit / pre-push hooks | Drift detection | `.githooks/pre-commit` runs gitleaks, the two-sided TS types regen, `tsc --noEmit` on backend + frontend (contract drift), the date-column type check, and the package-deps diagram check; `.githooks/pre-push` runs the schema-sync and OpenAPI-sync guardrails, checks generated artifacts haven't drifted, and lints `openapi.yaml` with Spectral. |

Run both backend guardrails at once with `npm run guardrail` (from
`petclinic-backend-ts/`).

## Known caveats

- **Schema-sync is name-only.** It asserts that the *set* of table and column
  names line up — it is lax on column *types*, *length* and *nullability*. A
  type/length regression is not caught here; it would surface at runtime against
  the real Postgres.

## Removed with the Java backend

The following guardrails were specific to the deleted Java backend and no longer
exist. Their concerns are either covered by the TS guardrails above or dropped:

- ~~**Package/architecture ArchUnit rules**~~ — replaced by the `package-deps.ts` guardrail above.
- **Domain class diagram extractor** — no equivalent; the domain model is
  documented in this repo's `CLAUDE.md` / `README.md`.
- **C4 model extractor** — removed.
- **Build hygiene (Javadoc / webpack-warning gates)** — Javadoc gate removed;
  the frontend still builds via `npm run build`.

## Considered, not scheduled

- **Test coverage floor** — per-folder thresholds for controllers / mappers.
- **Endpoint allow-list** — lint forbidding route decorators outside `*.controller.ts`.
- **Logging / observability invariants** — every REST handler logs entry+exit; no log line carries PII.
- **Performance / N+1 drift** — SQL-statement-count smoke tests on hot endpoints.
