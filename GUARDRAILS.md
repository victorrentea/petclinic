# PetClinic Guardrails

Automated checks against accidental drift, run **locally** in `.githooks/`,
**remotely** in CI, or **socially** via `.github/CODEOWNERS`.

## In place

| Guardrail | What it protects | How |
|---|---|---|
| Schema / entity sync (`test/guardrails/schema-sync.spec.ts`) | Entity ↔ migration drift | Offline check: collects every TypeORM `@Entity`/`@Column`/`@JoinColumn`/`@JoinTable` from `getMetadataArgsStorage()` (decorator side-effects, **no DB connection**) and cross-checks the resulting table/column **names** against the `CREATE TABLE` statements in the committed migrations under `src/migrations/`. Fails on entity-only tables/columns and on migrated tables/columns with no owning entity. Run with `npm run guardrail:schema`. |
| OpenAPI sync (`test/guardrails/openapi-sync.ts` + `openapi-document.ts`) | REST API contract | Boots the real `AppModule` offline (TypeORM connection neutralized — Swagger only needs controllers + DTO `@ApiProperty` metadata, no Postgres) and runs `SwaggerModule.createDocument` exactly as `src/main.ts` does. `npm run guardrail:openapi:generate` (re)writes the committed `openapi.yaml`; `npm run guardrail:openapi` diffs the live document against it and exits non-zero on drift. |
| TS ↔ OpenAPI sync | Stale generated frontend types | The frontend's `npm run generate:api` runs `openapi-typescript ../openapi.yaml -o src/app/generated/api-types.ts` (also wired as the frontend `prebuild` step and in the pre-commit hook); `api-types.ts` is regenerated / auto-staged on drift. |
| `gitleaks` (pre-commit) | Secrets in commits | Blocks commits containing detected secrets; a custom `secrets.env` value scan runs alongside it. |
| CODEOWNERS review | Sensitive files | `@victorrentea/elders` review required for contract & config files such as `openapi.yaml`, `.claude/settings*.json`, `.github/CODEOWNERS`, the CI workflow, and `petclinic-frontend/package.json`. |
| Pre-commit / pre-push hooks | Drift detection | `.githooks/pre-commit` runs gitleaks + the TS types regen; `.githooks/pre-push` runs the schema-sync and OpenAPI-sync guardrails, checks generated artifacts haven't drifted, and lints `openapi.yaml` with Spectral. |

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

- **Package/architecture ArchUnit rules** — no equivalent; the TS modules are
  small and enforced by code review.
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
