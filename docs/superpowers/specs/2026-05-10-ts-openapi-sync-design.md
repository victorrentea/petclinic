# Guardrail B: TS ↔ OpenAPI generated-types sync — Design

**Date:** 2026-05-10
**Status:** Approved for planning

## Goal

Ensure `petclinic-frontend/src/app/generated/api-types.ts` always reflects the current `openapi.yaml`. Catches the failure modes "AI hand-edited the generated TS to make a frontend feature work" and "openapi.yaml changed but the regen wasn't run, so the frontend silently runs against stale types."

## Mechanism

The frontend already has the regen tooling: `openapi-typescript` is a dev dependency and `package.json` defines `npm run generate:api` (currently wired only as `prebuild`). The guardrail piggybacks on this by running the regen at commit time and at CI time, then asserting the working tree's `api-types.ts` is unchanged.

## Files

- **Modify** `.githooks/pre-commit`: after the existing Maven extractor block, run `npm --prefix petclinic-frontend run generate:api` and `git add petclinic-frontend/src/app/generated/api-types.ts`. Skip with a one-line warning if `npm` is not on PATH or if `petclinic-frontend/node_modules` does not exist (backend-only contributor) — matches the gitleaks fallback pattern already in the hook.

- **Modify** `.github/workflows/ci-guardrails.yml`:
  - Insert a "Setup Node" step (Node 20, npm cache).
  - Insert `npm ci --prefix petclinic-frontend` before the test step.
  - Insert `npm --prefix petclinic-frontend run generate:api` after `./mvnw test`.
  - Extend the drift-check `git diff --quiet` paths to include `petclinic-frontend/src/app/generated/api-types.ts`.
  - Extend the "Auto-commit regenerated artifacts" step's `git add` to include the same path.

- **Modify** `GUARDRAILS.md`: move guardrail B from 🚧 to ✅.

## What it catches

- ✅ AI hand-edits `api-types.ts` to make a feature work.
- ✅ A backend change touches `openapi.yaml` (caught by `OpenApiSyncTest`) but the contributor never runs `npm run build`, so `api-types.ts` is stale on commit.
- ✅ A frontend contributor edits the OpenAPI spec directly to fit a new TS hand-edit (defeats the round-trip and surfaces in the diff).

## Existing pattern this matches

The C4 diagram + `db.sql` flow does exactly this: pre-commit regenerates and stages; CI regenerates and auto-commits drift back to main with `[skip ci]`; fork PRs fail loud. The TS-types regen joins that flow.

## Non-goals

- Validating the actual TS code shape (linting, type-check) — `ng build` and existing TS compilation handle that.
- Catching frontend-side hand-edits to non-generated files that happen to use stale types — those surface as TS compile errors during build.
- Adding `openapi-typescript` to backend's classpath. The guardrail is a sibling check, not a coupling.

## Cost

- Pre-commit: +~1-2s for the `npm run generate:api` invocation. The `npm` invocation is silent in -q mode.
- CI: +~30-60s for `npm ci --prefix petclinic-frontend` + the regen, dominated by `npm ci`. Cacheable via the `setup-node` action's npm cache.

## Caveats

- Backend-only contributors who never `npm install` will see a hook warning. Acceptable: the hook still completes, CI catches actual drift.
- The `npm ci` step in CI will fail if `package-lock.json` is out of sync with `package.json` — that is itself a useful signal but unrelated to this guardrail.
