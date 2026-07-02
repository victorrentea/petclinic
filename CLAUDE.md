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
./start-grafana.sh         # optional: Grafana LGTM (Ctrl+C tears it down)
./start-structurizr.sh     # optional: Structurizr Lite view of the C4 model (localhost:8081)
```

## Architecture

### Living Architecture & Guardrails

[//]: # (@include GLOSSARY.md)
See [GUARDRAILS.md](GUARDRAILS.md) for the full list of guardrail tests, living architecture diagrams, and CI drift checks.

### Database
- **Dev:** Embedded PostgreSQL via `./start-database.sh` (Java jar, localhost:5432)
- **Tests:** Embedded PostgreSQL (auto-started in-process, no setup needed)

### Security
- Disabled by default
- Enable via `petclinic.security.enable=true`
- Roles: `OWNER_ADMIN`, `VET_ADMIN`, `ADMIN`
- Default user: `admin`/`admin`

## Data Volume / Scale

- **Owners table holds ~1 million rows.** Never assume the owner list is small:
  no loading the full list into memory (browser or backend), no client-side
  filtering, and any owner search/list must be paginated and filtered in SQL.

## Domain Model (ER Model)

Core entities and relationships:
- **Owner** 1→N **Pet** N→1 **PetType**
- **Pet** 1→N **Visit**
- **Vet** N→N **Specialty** (via `vet_specialties` join table)
- **User** 1→N **Role**

## API

The REST API is described by its OpenAPI spec — the single source of truth.
Browse it at http://localhost:8080/swagger-ui.html (don't duplicate the endpoint
list here; it drifts).

## Development Notes

### Owner's Code Preferences
Java/Spring conventions live in the `java` skill (`.claude/skills/java/`), which
loads automatically when reviewing or rewriting backend Java.

## Task Modifiers
- Write non-trivial code using TDD.
- Keep comments concise, prefer explanatory variable/method names.
- Never ask before running tests after refactoring.
- Auto-push after commit if git username is `victorrentea` and repo is `github.com/victorrentea/*`
- Keep explanations concise we are experience spring java devs
- Challenge ambiguous/wrong prompts
