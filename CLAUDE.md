# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack PetClinic application with Angular frontend and Spring Boot backend, managing veterinary clinic operations (owners, pets, vets, visits, specialties).

**Structure:**
- `petclinic-backend/` - Spring Boot 3.5 REST API (Java 21)
- `petclinic-frontend/` - Angular 16 SPA (Angular Material + Bootstrap 3)

## Common Commands


### Full Stack
Each script is foreground; run them in separate terminals.
```sh
./install-all.sh           # one-time: mvn install + npm install for all modules
./start-database.sh        # embedded Postgres on localhost:5432
./start-backend.sh         # Spring Boot on localhost:8080 (also hosts Spring AI MCP at /mcp)
./start-frontend.sh        # Angular dev server on localhost:4200
./start-observability.sh   # optional: Grafana LGTM (Ctrl+C tears it down)
```

Frontend commands live in [petclinic-frontend/CLAUDE.md](petclinic-frontend/CLAUDE.md).

### Testing a Single Test (Backend)
```sh
mvn test -Dtest=ClassName#methodName
```

## Architecture

Backend architecture (layers, MapStruct codegen, data flow, key patterns) lives in [petclinic-backend/CLAUDE.md](petclinic-backend/CLAUDE.md).

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

## Task Modifiers
- Write non-trivial code using TDD.
- Keep comments concise, prefer explanatory variable/method names.
- Auto-push after commit if git username is `victorrentea` and repo is `github.com/victorrentea/*`
- Keep explanations concise
- Challenge ambiguous/wrong prompts
