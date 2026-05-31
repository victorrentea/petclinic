# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack PetClinic application with an Angular frontend and a NestJS/TypeScript backend, managing veterinary clinic operations (owners, pets, vets, visits, specialties).

**Structure:**
- `petclinic-backend-ts/` - NestJS 10 REST API + MCP server (TypeScript, TypeORM, PostgreSQL) — the ONLY backend
- `petclinic-frontend/` - Angular 16 SPA (Angular Material + Bootstrap 3)
- `petclinic-observability/` - Grafana LGTM stack (metrics + logs + traces)
- `petclinic-ui-test/` - Playwright end-to-end tests

## Common Commands

### Full Stack
Each script is foreground; run them in separate terminals.
```sh
./install-all.sh           # one-time: npm install for all modules + git hooks
./start-database.sh        # PostgreSQL via Docker Compose on localhost:5432
./start-backend-ts.sh      # NestJS on localhost:8080 (builds, runs TypeORM migrations, boots; also hosts MCP at /sse)
./start-frontend.sh        # Angular dev server on localhost:4200 (talks to :8080)
./start-observability.sh   # optional: Grafana LGTM (Ctrl+C tears it down)
```

### Backend (petclinic-backend-ts/)
```sh
npm run build                       # nest build
npm run start:dev                   # Run backend in watch mode
npm test                            # Jest unit tests
npm run test:e2e                    # Jest e2e tests
npm run migration:run               # Apply TypeORM migrations (schema + seed data)
```

### Frontend (petclinic-frontend/)
```sh
npm start                           # Dev server on localhost:4200
npm run build                       # Production build (regenerates API types first)
npm test                            # Karma tests
npm run test-headless               # Headless Chrome tests
```

### Testing a Single Test (Backend)
```sh
npm test -- --testNamePattern="some test name"
npm test -- path/to/file.spec.ts
```

## Architecture

### Backend Architecture

**Layered Structure (NO service layer):**
1. REST Controllers (`src/<domain>/<name>.controller.ts`) - expose API endpoints; inject TypeORM repositories directly via `@InjectRepository(Entity)`
2. Mappers (`src/<domain>/<name>.mapper.ts`) - stateless plain functions for entity↔DTO conversion (no DI)
3. Repository Layer - TypeORM repositories (no hand-written repository classes)
4. Domain Model (`src/<domain>/<name>.entity.ts`) - TypeORM entities (Owner, Pet, Vet, Visit, Specialty, PetType, User, Role)

**Key Patterns:**
- DTOs are hand-written in `src/<domain>/dto/` with `class-validator` decorators
- Stateless mapper functions in `*.mapper.ts` (no `@Injectable`, no Nest DI) convert entities ↔ DTOs
- Global RFC-7807 ProblemDetail exception filter (`src/common/all-exceptions.filter.ts`)
- Constructor injection throughout; controllers wire the route behaviour
- `openapi.yaml` at project root is generated output (from the OpenAPI sync guardrail), not a source spec

**Data Flow:**
Request → REST Controller → TypeORM Repository / Mapper → Entity
Response ← REST Controller ← Mapper (Entity→DTO) ← Repository

**MCP Server:**
- An MCP server is exposed over SSE at `/sse` (POST messages at `/mcp/messages`)
- Authenticated with `X-API-Key` (maps an API key → owner id); see `src/mcp/`

### Living Architecture & Guardrails

See [GUARDRAILS.md](GUARDRAILS.md) for the full list of guardrail tests and CI drift checks.

### Database
- **Schema** is owned by TypeORM migrations under `src/migrations/` (`synchronize: false`, never auto-DDL); seeded with sample data
- **Dev:** PostgreSQL via Docker Compose — start it with `./start-database.sh` (localhost:5432)
- Run migrations with `npm run migration:run` (idempotent; `start-backend-ts.sh` does this automatically)

### Security
- Disabled by default (permit all)
- Enable via `PETCLINIC_SECURITY_ENABLE=true`
- HTTP Basic auth backed by the `users`/`roles` tables (bcrypt passwords)
- Role-based access via a `@Roles()` decorator + `RolesGuard`
- Roles: `ROLE_OWNER_ADMIN`, `ROLE_VET_ADMIN`, `ROLE_ADMIN`
- Default user: `admin`/`admin`

### Observability
- OpenTelemetry zero-code auto-instrumentation exports to the Grafana LGTM stack via OTLP on `:4318`
- Start the stack with `./start-observability.sh` (Grafana at http://localhost:3300, admin/admin)

## Domain Model (ER Model)

Core entities and relationships:
- **Owner** 1→N **Pet** N→1 **PetType**
- **Pet** 1→N **Visit**
- **Vet** N→N **Specialty** (via `vet_specialties` join table)
- **User** 1→N **Role**

## API Endpoints
Backend exposes REST API at http://localhost:8080/api/
- Owners: `/api/owners`, `/api/owners/{id}`
- Pets: `/api/pets`, `/api/pets/{id}`
- Vets: `/api/vets`, `/api/vets/{id}`
- Visits: `/api/visits`
- PetTypes: `/api/pettypes`
- Specialties: `/api/specialties`
- Users: `/api/users`

Swagger UI: http://localhost:8080/swagger-ui

## Development Notes

### Owner's Code Preferences
- Constructor injection for production code
- Hand-written stateless mapper functions for DTO mapping (no codegen, no DI)
- `class-validator` decorators on request DTOs for validation
- Global exception handling via a single Nest exception filter (RFC-7807 ProblemDetail)
- Keep line length ≤ 120 chars
- Never ask before running tests after refactoring
- Builder/object chains: one property per line, unless only 2 properties total

## Task Modifiers
- Always write code using red-green TDD: write a failing test first, confirm it fails, then implement — no production code without a prior failing test
- Auto-push after commit if git username is `victorrentea` and repo is `github.com/victorrentea/*`
- Keep explanations concise
- Challenge ambiguous/wrong prompts
