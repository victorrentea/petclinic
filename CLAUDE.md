# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack PetClinic application with Angular frontend and Spring Boot backend, managing veterinary clinic operations (owners, pets, vets, visits, specialties).

**Structure:**
- `petclinic-backend/` - Spring Boot 3.5 REST API (Java 21); also hosts the Spring AI MCP server at `/mcp`
- `petclinic-frontend/` - Angular 16 SPA (Angular Material + Bootstrap 3)
- `petclinic-custom-chatbot/` - separate Spring AI triage assistant (OpenAI-only): RAG over specialties → books a visit via the backend MCP
- `petclinic-ui-test/` - Playwright + Cucumber end-to-end UI tests
- `petclinic-database/` - embedded Postgres launcher + seed data
- `petclinic-observability/` - opt-in Grafana LGTM + OpenTelemetry stack (see README)

## Common Commands


### Full Stack
Each script is foreground; run them in separate terminals.
```sh
./install-all.sh           # one-time: mvn install + npm install for all modules
./start-database.sh        # embedded Postgres on localhost:5432
./start-backend.sh         # Spring Boot on localhost:8080 (also hosts Spring AI MCP at /mcp)
./start-frontend.sh        # Angular dev server on localhost:4200
./start-chatbot.sh         # Spring AI triage chatbot (needs its own pgvector + OPENAI_API_KEY)
./start-ui-tests.sh        # Playwright e2e suite in petclinic-ui-test/
./start-observability.sh   # optional: Grafana LGTM (Ctrl+C tears it down)
```

### Backend (petclinic-backend/)
```sh
./mvnw spring-boot:run              # Run backend
./mvnw test                         # Run tests
./mvnw clean install                # Build + regenerate MapStruct mappers
```
Checkstyle runs in the `validate` phase (config: `petclinic-backend/checkstyle.xml`) and fails the build on any line > 120 chars (main + test sources).

### Frontend (petclinic-frontend/)
```sh
npm start                           # Dev server on localhost:4200
npm run build                       # Production build
npm test                            # Karma tests
npm run test-headless               # Headless Chrome tests
npm run e2e                         # Protractor e2e tests
```

### Testing a Single Test (Backend)
```sh
./mvnw test -Dtest=ClassName#methodName
```

## Architecture

### Living Architecture & Guardrails

See [GUARDRAILS.md](GUARDRAILS.md) for the full list of guardrail tests, living architecture diagrams, and CI drift checks.

### Database
- **Dev:** Embedded PostgreSQL via `./start-database.sh` (Java jar, localhost:5432)
- **Tests:** Embedded PostgreSQL (auto-started in-process, no setup needed)

### Security
- Disabled by default
- Enable via `petclinic.security.enable=true`
- Roles: `OWNER_ADMIN`, `VET_ADMIN`, `ADMIN`
- Default user: `admin`/`admin`

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

OpenAPI docs: http://localhost:8080/swagger-ui.html

## Development Notes

### Owner's Code Preferences (from copilot-instructions.md)
- `@Transactional` only when strictly necessary
- MapStruct for DTO mapping
- Use Lombok: `@Slf4j`, `@RequiredArgsConstructor`, `@Builder`, `@Getter`/`@Setter` selectively
- Keep line length ≤ 120 chars
- Never ask before running tests after refactoring
- Builder chains: one property per line, unless only 2 properties total

## Task Modifiers
- Write non-trivial code using TDD
- Keep comments concise, prefer explanatory variable/method names.
- Auto-push after commit if git username is `victorrentea` and repo is `github.com/victorrentea/*`
- Keep explanations concise
- Challenge ambiguous/wrong prompts
