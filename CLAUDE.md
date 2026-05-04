# CLAUDE.md

Cross-cutting guidance for Claude Code on this monorepo. Backend- and frontend-specific rules live in nested `CLAUDE.md` files (auto-loaded when working under those folders).

## Project Overview

Full-stack PetClinic application managing veterinary clinic operations (owners, pets, vets, visits, specialties).

**Structure:**
- `petclinic-backend/` — Spring Boot 3.5 REST API (Java 21) — see `petclinic-backend/CLAUDE.md`
- `petclinic-frontend/` — Angular 16 SPA

## Common Commands

```sh
./run-all.sh  # Start both backend (8080) and frontend (4200)
```

**Note:** The script `run-all.sh` references old directories (`petclinic-rest`, `petclinic-angular`) instead of current names (`petclinic-backend`, `petclinic-frontend`).

### Frontend (petclinic-frontend/)
```sh
npm start                           # Dev server on localhost:4200
npm run build                       # Production build
npm test                            # Karma tests
npm run test-headless               # Headless Chrome tests
npm run e2e                         # Protractor e2e tests
```

## Frontend Architecture
- Angular 16 with Material + Bootstrap 3
- Services communicate with backend REST API
- RxJS for async operations

## Code Preferences (cross-cutting)

- Keep explanations concise
- Challenge ambiguous/wrong prompts
- Line length ≤ 120 chars
- Always use TDD: write a failing test first, confirm it fails, then implement — no production code without a prior failing test
- Never ask before running tests after refactoring

## Task Modifiers
- "fast", "go", "Sparta" → skip build/tests
- "explain and commit" → summarize change as training note
- Auto-push after commit if git username is `victorrentea` and repo is `github.com/victorrentea/*`
