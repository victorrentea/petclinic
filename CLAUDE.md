# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack PetClinic application with Angular frontend and Spring Boot backend, managing veterinary clinic operations (owners, pets, vets, visits, specialties).

**Structure:**
- `petclinic-backend/` - Spring Boot 3.5 REST API (Java 21)
- `petclinic-frontend/` - Angular 16 SPA (Bootstrap 3)
- `petclinic-ui-test/` - Playwright e2e tests

## Common Commands

### Full Stack
Each script is foreground; run them in separate terminals.
```sh
./install-all.sh           # one-time: mvn install + npm install for all modules
./start-database.sh        # embedded Postgres on localhost:5432
./start-backend.sh         # Spring Boot on localhost:8080
./start-frontend.sh        # Angular dev server on localhost:4200
./start-observability.sh   # optional: Grafana LGTM (Ctrl+C tears it down)
```

See sub-module `CLAUDE.md` files for backend and frontend specifics.

## Database
- **Dev:** Embedded PostgreSQL via `./start-database.sh` (localhost:5432)
- **Tests:** Embedded PostgreSQL (auto-started in-process, no setup needed)

## Security
- Disabled by default; enable via `petclinic.security.enable=true`
- Roles: `OWNER_ADMIN`, `VET_ADMIN`, `ADMIN` — default user: `admin`/`admin`

## Domain Model

- **Owner** 1→N **Pet** N→1 **PetType**
- **Pet** 1→N **Visit**
- **Vet** N→N **Specialty** (via `vet_specialties` join table)
- **User** 1→N **Role**

## API Endpoints
REST API at http://localhost:8080/api/ — OpenAPI docs: http://localhost:8080/swagger-ui.html

See [GUARDRAILS.md](GUARDRAILS.md) for guardrail tests and CI drift checks.

## Task Modifiers
- Always write code using red-green TDD: write a failing test first, confirm it fails, then implement — no production code without a prior failing test
- Auto-push after commit if git username is `victorrentea` and repo is `github.com/victorrentea/*`
- Keep explanations concise
- Challenge ambiguous/wrong prompts
