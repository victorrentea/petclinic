# Project Memory - AGENTS.md ~ CLAUDE.md

This file is automatically loaded in any conversation you have with an agent in this folder. It's the most important file in any repo, pushed on git, improved on any AI fail, reviewed every sprint, symlinked to AGENTS.md for inclusiveness.

## Project Overview

Full-stack PetClinic application with Angular frontend and Spring Boot backend, managing veterinary clinic operations (owners, pets, vets, visits, specialties).

**Structure:**1r
- `petclinic-backend/` - Spring Boot 3.5 REST API (Java 21), also hosts the MCP server at `/mcp` — port 8080
- `petclinic-frontend/` - Angular 16 SPA (Angular Material + Bootstrap 3) — port 4200
- `petclinic-chatbot/` - Spring AI triage assistant: RAG over a specialty knowledge base, books visits via the backend's MCP tools — port 8082
- `petclinic-database/` - embedded Postgres launcher (`./start-database.sh`) — port 5432
- `petclinic-ui-test/` - Playwright + Cucumber end-to-end UI tests (needs backend + frontend running)
- `petclinic-observability/` - OpenTelemetry collector + Grafana stack (`docker-compose.yml`, `./start-grafana.sh`)
- `openspec/` - spec-driven change proposals (`specs/`, `changes/`)
- `user-manual/` - end-user manual (`manual.md` + screenshots)
- `docs/`, `scripts/` - shared docs and repo tooling

## Common Commands

### Full Stack
Each script is foreground; run them in separate terminals.
```sh
./start-database.sh        # embedded Postgres on localhost:5432
./start-backend.sh         # Spring Boot on localhost:8080 (also hosts Spring AI MCP at /mcp)
./start-frontend.sh        # Angular dev server on localhost:4200
./start-grafana.sh
```

The C4 model viewer now lives with the backend docs it serves:
```sh
petclinic-backend/docs/scripts/start-structurizr.sh   # optional: Structurizr view of the C4 model (localhost:8081)
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

Backend exposes its REST API under http://localhost:8080/api/.

Read [`openapi.yaml`](openapi.yaml).

Browsable while the backend runs: http://localhost:8080/swagger-ui.html
See [GUARDRAILS.md](GUARDRAILS.md) for the full drift-check list.

## Development Notes

### Owner's Code Preferences

Java/Spring house style lives in the **`java` skill**
([.claude/skills/java/SKILL.md](.claude/skills/java/SKILL.md)) — it is loaded automatically
whenever Java code is written or reviewed.

## Task Modifiers
- Write non-trivial code using TDD
- Keep comments concise, prefer explanatory variable/method names.
- Always run tests after any refactoring
- Keep explanations concise, we are experienced be developers.
- Challenge ambiguous prompts. Tell me when I'm wrong!  
