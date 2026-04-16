# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.



## Project Overview

Full-stack PetClinic application with Angular frontend and Spring Boot backend, managing veterinary clinic operations (owners, pets, vets, visits, specialties).

**Structure:**
- `petclinic-backend/` - Spring Boot 3.5 REST API (Java 21) — see `petclinic-backend/AGENTS.md`
- `petclinic-frontend/` - Angular 16 SPA — see `petclinic-frontend/AGENTS.md`

## Common Commands

```sh
./run-all.sh  # Start both backend (8080) and frontend (4200)
```

**Note:** `run-all.sh` references old directories (`petclinic-rest`, `petclinic-angular`) instead of current names (`petclinic-backend`, `petclinic-frontend`).

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

## Code Preferences

- Keep explanations concise
- Challenge ambiguous/wrong prompts
- Constructor injection for production, `@Autowired` only in tests
- `@Transactional` only when strictly necessary
- MapStruct for DTO mapping
- Global exception handling in `@RestControllerAdvice`
- `@Validated` on `@RequestBody`
- Use Lombok: `@Slf4j`, `@RequiredArgsConstructor`, `@Builder`, `@Getter`/`@Setter` selectively
- Line length ≤ 120 chars
- Java 21+, Spring Boot 3
- Never ask before running tests after refactoring
- Always use TDD: write a failing test first, confirm it fails, then implement — no production code without a prior failing test
- Builder chains: one property per line, unless only 2 properties total

## Task Modifiers
- "fast", "go", "Sparta" → skip build/tests
- "explain and commit" → summarize change as training note
- Auto-push after commit if git username is `victorrentea` and repo is `github.com/victorrentea/*`
