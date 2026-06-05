# CLAUDE.md

Full-stack PetClinic application managing veterinary clinic operations (owners, pets, vets, visits, specialties).

**Structure:**
- `petclinic-backend-ts/` - NestJS 10 REST API + MCP server — the ONLY backend (see its CLAUDE.md)
- `petclinic-frontend/` - Angular 16 SPA (Angular Material + Bootstrap 3)
- `petclinic-observability/` - Grafana LGTM stack (metrics + logs + traces)
- `petclinic-ui-test/` - Playwright end-to-end tests

## Running the Stack
Each script is foreground; run them in separate terminals.
```sh
./install-all.sh           # one-time: npm install for all modules + git hooks
./start-database.sh        # PostgreSQL via Docker Compose on localhost:5432
./start-backend-ts.sh      # NestJS on localhost:8080 (builds, migrates, boots; hosts MCP at /sse)
./start-frontend.sh        # Angular dev server on localhost:4200 (talks to :8080)
./start-observability.sh   # optional: Grafana LGTM on http://localhost:3300, admin/admin (Ctrl+C tears it down)
```

Frontend: `npm start` (dev server), `npm run build` (regenerates API types first), `npm run test-headless` (Karma).

## Architecture
- REST API at http://localhost:8080/api/ (`/owners`, `/pets`, `/vets`, `/visits`, `/pettypes`, `/specialties`, `/users`); Swagger UI at http://localhost:8080/swagger-ui
- See `GUARDRAILS.md` for guardrail tests and CI drift checks
- OpenTelemetry auto-instrumentation exports to the LGTM stack via OTLP on `:4318`

## Domain Model
- **Owner** 1→N **Pet** N→1 **PetType**; **Pet** 1→N **Visit**
- **Vet** N→N **Specialty** (via `vet_specialties`)
- **User** 1→N **Role**

## Task Modifiers
- Always write code using red-green TDD: write a failing test first, confirm it fails, then implement — no production code without a prior failing test
- Before writing/refactoring code, load the `code-style` skill
- Never ask before running tests after refactoring
- Auto-push after commit if git username is `victorrentea` and repo is `github.com/victorrentea/*`
- Keep explanations concise
- Challenge ambiguous/wrong prompts
