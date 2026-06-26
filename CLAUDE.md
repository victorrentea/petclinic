# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack PetClinic application with Angular frontend and Spring Boot backend, managing veterinary clinic operations (owners, pets, vets, visits, specialties).

**Structure:**
- `petclinic-backend/` - Spring Boot 3.5 REST API (Java 21)
- `petclinic-frontend/` - Angular 16 SPA (Angular Material + Bootstrap 3)

## Scale Assumptions (non-functional)

The business targets ~1 million owners (and proportionally large pets/visits). Despite the
tiny seed dataset, **treat data volume as large**: list screens MUST sort, filter, and
paginate **server-side** and never load all rows into the client or memory. Prefer Spring Data
`Pageable`/`Page`/`Sort` (or equivalent) over fetching full `List<>`s for any growable entity.

**Never issue N+1 queries** (a query per row, in a loop) — the round-trips kill latency at scale.
Load related collections in bulk: batch fetching (`hibernate.default_batch_fetch_size` / `@BatchSize`),
a single `IN (...)` query, or a join. Also never `JOIN FETCH` a to-many together with pagination
(Hibernate paginates in memory) — page the root scalar-only, then batch-load the children.

## Common Commands


### Full Stack
Each script is foreground; run them in separate terminals.
```sh
./install-all.sh           # one-time: mvn install + npm install for all modules
./start-database.sh        # embedded Postgres on localhost:5432
./start-backend.sh         # Spring Boot on localhost:8080 (also hosts Spring AI MCP at /mcp)
./start-frontend.sh        # Angular dev server on localhost:4200
./start-grafana.sh         # optional: Grafana LGTM (Ctrl+C tears it down)
```


## Architecture

### Backend Architecture

Backend-specific layering, data flow, and patterns live in `petclinic-backend/CLAUDE.md`,
auto-loaded by the harness when you read/write any file in that module.

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
Backend exposes REST API as per `openapi.yaml` kept in sync with the code.

## Development Notes

### Java Style
Java coding conventions live in the lazy-loaded `java-style` skill
(`.claude/skills/java-style/`), invoked automatically when writing/reviewing Java.

## Task Modifiers
- Write non-trivial code using TDD.
- Keep comments concise, prefer explanatory variable/method names.
- Auto-push after commit if git username is `victorrentea` and repo is `github.com/victorrentea/*`
- Keep explanations concise because this team is mid-sr, with 5+ exp in Spring, and 1y exp in ng
- Challenge ambiguous/wrong prompts; don't sycophancy me
