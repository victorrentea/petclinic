# CLAUDE.md — Frontend (petclinic-frontend/)

Guidance for working in the Angular 16 SPA (Angular Material + Bootstrap 3).
Standard Angular CLI scripts (`npm start`, `npm test`, `npm run e2e`) behave as expected — see `package.json`. Below are only the non-obvious bits.

## API types are generated from OpenAPI
`src/app/generated/api-types.ts` is generated, not hand-written. `npm run generate:api` runs `openapi-typescript` against the project-root `../openapi.yaml`. This runs automatically as a `prebuild` step, so a build always refreshes the types. Don't edit the generated file; regenerate it. `npm run lint:openapi` validates the spec via Spectral.

## Build is strict
`npm run build` runs `scripts/build-strict.sh` (which fails on warnings), not a plain `ng build`. Use `npm run build:raw` for a quick unguarded `ng build`.

## Headless tests
`npm run test-headless` runs Karma once against the `ChromeHeadlessCI` browser (no watch, no progress) — this is the CI-friendly variant of `npm test`.
