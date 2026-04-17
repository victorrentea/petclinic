# Project Memory Sync

Load and follow the repository memory from `AGENTS.md`.

## Mandatory Rule
- Any new project memory, conventions, or workflow rules must be added to `AGENTS.md`.
- If you discover a new recurring rule while implementing a task, append it to `AGENTS.md` in the most relevant section.

## Imported Content (`AGENTS.md`)

````markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack PetClinic application with Angular frontend and Spring Boot backend, managing veterinary clinic operations (owners, pets, vets, visits, specialties).

**Structure:**
- `petclinic-backend/` - Spring Boot 3.5 REST API (Java 21)
- `petclinic-frontend/` - Angular 16 SPA

## Common Commands

### Full Stack
```sh
./run-all.sh  # Start both backend (8080) and frontend (4200)
```

### Backend (petclinic-backend/)
```sh
./mvnw spring-boot:run              # Run backend
./mvnw test                         # Unit tests
./mvnw clean install                # Build + generate code (MapStruct, OpenAPI)
./postman-tests.sh                  # API tests (Newman)
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

### Testing a Single Test (Backend)
```sh
./mvnw test -Dtest=ClassName#methodName
```

## Architecture

### Backend Architecture

**Layered Structure:**
1. REST Controllers (`petclinic-backend/src/main/java/.../rest/`) - expose API endpoints
2. Service Layer (`ClinicServiceImpl`) - business logic
3. Repository Layer (`repository/springdatajpa/`) - Spring Data JPA repositories
4. Domain Model (`model/`) - JPA entities (Owner, Pet, Vet, Visit, Specialty, PetType, User, Role)

**Generated Code:**
- MapStruct mappers -> `target/generated-sources/.../mapper/`
- OpenAPI DTOs -> `target/generated-sources/.../rest/dto/`
- Regenerate via `mvn clean install`

**Data Flow:**
Request -> Controller -> Service -> Repository -> JPA Entity
Response <- Controller <- Mapper (Entity->DTO) <- Service <- Repository

**Key Patterns:**
- DTOs for API contracts (generated from OpenAPI spec at `petclinic-backend/src/main/resources/openapi.yml`)
- MapStruct for entity<->DTO mapping
- Constructor injection (Lombok `@RequiredArgsConstructor`)
- Global exception handling via `@RestControllerAdvice`

### Database
- **Default:** H2 in-memory (auto-populated)
  - Console: http://localhost:8080/h2-console (`jdbc:h2:mem:petclinic`, user: `sa`, no password)
- **Alternative:** PostgreSQL via `spring.profiles.active=postgres` + `docker-compose --profile postgres up`

### Security
- Disabled by default
- Enable via `petclinic.security.enable=true`
- Roles: `OWNER_ADMIN`, `VET_ADMIN`, `ADMIN`
- Default user: `admin`/`admin`

### Frontend Architecture
- Angular 16 with Material + Bootstrap 3
- Services communicate with backend REST API
- RxJS for async operations

## Domain Model (ER Model)

Core entities and relationships:
- **Owner** 1->N **Pet** N->1 **PetType**
- **Pet** 1->N **Visit**
- **Vet** N->N **Specialty** (via `vet_specialties` join table)
- **User** 1->N **Role**

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

### Code Generation
Run `mvn clean install` when:
- Modifying `openapi.yml`
- Adding/changing MapStruct mappers
- Generated classes are in `target/generated-sources/`

### Owner's Code Preferences (from copilot-instructions.md)
- Keep explanations concise
- Challenge ambiguous/wrong prompts
- Constructor injection for production, `@Autowired` only in tests
- `@Transactional` only when strictly necessary
- MapStruct for DTO mapping
- Global exception handling in `@RestControllerAdvice`
- `@Validated` on `@RequestBody`
- Use Lombok: `@Slf4j`, `@RequiredArgsConstructor`, `@Builder`, `@Getter`/`@Setter` selectively
- Line length <= 120 chars
- Java 21+, Spring Boot 3
- Never ask before running tests after refactoring
- Always use TDD: write a failing test first, confirm it fails, then implement - no production code without a prior failing test
- Builder chains: one property per line, unless only 2 properties total

### Task Modifiers
- "fast", "go", "Sparta" -> skip build/tests
- "explain and commit" -> summarize change as training note
- Auto-push after commit if git username is `victorrentea` and repo is `github.com/victorrentea/*`
````

