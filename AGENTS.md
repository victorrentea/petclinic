# AGENTS.md

This file provides shared guidance to AI coding agents working in this repository.

## Project Overview

Full-stack PetClinic application with:

- `petclinic-backend/` - Spring Boot 3.5 REST API (Java 21)
- `petclinic-frontend/` - Angular 16 SPA
- `petclinic-test/` - Playwright E2E tests (TypeScript)

## Area-Specific Guidance

- See `backend.md` for backend commands, architecture, code generation, database/security notes, and Java/Spring conventions.
- See `frontend.md` for frontend commands, Angular/Playwright architecture, and UI testing guidance.

## Common Commands

```sh
./start-all.sh          # Start both backend (8080) and frontend (4200)
./start-backend.sh      # Start backend only
./start-frontend.sh     # Start frontend only
./start-tests.sh        # Run Playwright E2E tests (apps must be running first)
```

## Cross-Stack Architecture

- The backend exposes the REST API on `http://localhost:8080/api/`.
- The frontend runs on `http://localhost:4200` and communicates with the backend via REST services.
- `petclinic-test/` contains Playwright E2E tests that exercise the running frontend and backend together.

## Shared Domain Model

Core entities and relationships:

- **Owner** 1→N **Pet** N→1 **PetType**
- **Pet** 1→N **Visit**
- **Vet** N→N **Specialty** (via `vet_specialties` join table)
- **User** 1→N **Role**

## Shared Development Notes

- `CLAUDE.md` points here for repository-wide context.
- `.github/copilot-instructions.md` contains shared unit-test conventions.

### Task Modifiers

- "fast", "go", "Sparta" → skip build/tests
- "explain and commit" → summarize change as training note
- Auto-push after commit if git username is `victorrentea` and repo is `github.com/victorrentea/*`
