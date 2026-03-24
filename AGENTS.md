# AGENTS.md

## Scope
- Full-stack PetClinic monorepo: `petclinic-backend/` (Spring Boot 3.5, Java 21), `petclinic-frontend/` (Angular 16), `qa/` (Selenium black-box tests).
- Backend and frontend are developed independently and communicate only through the REST API at `http://localhost:8080/api/`.
- Prefer narrow, side-specific changes. Each subfolder has its own `AGENTS.md` with detailed conventions.

## Fast paths
- Full stack: `./run-all.sh` from repo root (backend `:8080`, frontend `:4200`).
- QA suite (app must already be running): `cd qa && mvn test`

## API contract
- The checked-in API contract is the root `openapi.yaml`.
- Any change to the OpenAPI contract must be explicitly confirmed by a human.

## Agent guardrails
- Trust the source tree over older prose docs (no `service/ClinicServiceImpl`, no `src/main/resources/openapi.yml`).
- Do not edit anything under `target/`, `generated-sources/`, or `surefire-reports/`.
- Use `@Autowired` only in tests; production classes use constructor injection (`@RequiredArgsConstructor`).

## Remembered user preferences
- If a user explicitly asks to remember a standing preference, persist it by updating agent instruction docs (this file, or the nearest scoped `AGENTS.md` when more appropriate).
- Project-visible artifacts intended for other humans must be in English only. This includes source code comments, documentation, commit or PR text, and user-facing copy in this repository. Do not write these in Romanian.

