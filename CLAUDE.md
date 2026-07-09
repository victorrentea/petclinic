# Project Memory - AGENTS.md ~ CLAUDE.md

This file is automatically loaded in any conversation you have with an agent in this folder. It's the most important file in any repo, pushed on git, improved on any AI fail, reviewed every sprint, symlinked to AGENTS.md for inclusiveness.

## Project Overview

Full-stack PetClinic application with Angular frontend and Spring Boot backend, managing veterinary clinic operations (owners, pets, vets, visits, specialties).

**Structure:**
- `petclinic-backend/` - Spring Boot 3.5 REST API (Java 21)
- `petclinic-frontend/` - Angular 16 SPA (Angular Material + Bootstrap 3)

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

### Backend (petclinic-backend/)
```sh
mvn spring-boot:run              # Run backend
mvn test                         # Run tests
mvn clean install                # Build + regenerate MapStruct mappers
```

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
mvn test -Dtest=ClassName#methodName
```

## Architecture

### Backend Architecture

**Layered Structure:**
1. REST Controllers (`petclinic-backend/src/main/java/.../rest/`) - expose API endpoints
2. Mappers (`mapper/`) - MapStruct entity↔DTO conversion
3. Repository Layer (`repository/`) - Spring Data JPA interfaces (no service layer!)
4. Domain Model (`model/`) - JPA entities (Owner, Pet, Vet, Visit, Specialty, PetType, User, Role)

**Generated Code:**
- MapStruct mapper implementations → `target/generated-sources/annotations/`
- Regenerate via `mvn clean install`

**Data Flow:**
Request → REST Controller → Repository / Mapper → JPA Entity
Response ← REST Controller ← Mapper (Entity→DTO) ← Repository

**Key Patterns:**
- DTOs are hand-written in `src/main/java/.../rest/dto/` (not generated)
- `openapi.yaml` at project root is generated output (from `OpenApiExtractorTest`), not a source spec
- Constructor injection (`@RequiredArgsConstructor`), global exception handling via `@RestControllerAdvice`

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

The class diagram lives in [`petclinic-backend/docs/generated/DomainModel.puml`](petclinic-backend/docs/generated/DomainModel.puml)
— the source of truth. Don't hand-maintain the entity/relationship list here; it drifts.
`DomainModelExtractorTest` regenerates it from the JPA annotations and CI fails on drift
(see [GUARDRAILS.md](GUARDRAILS.md)).

## API Endpoints

The full REST API contract lives in [`openapi.yaml`](openapi.yaml) — the source of truth.
Don't hand-maintain an endpoint list here; it drifts. `OpenApiExtractorTest` regenerates
`openapi.yaml` from the running app and CI fails on drift (see [GUARDRAILS.md](GUARDRAILS.md)).

- Base URL: http://localhost:8080/api/
- Interactive docs (app running): http://localhost:8080/swagger-ui.html

## Task Modifiers
- Write non-trivial code using TDD
- Keep comments concise, prefer explanatory variable/method names.
- Always run tests after any refactoring
- Keep explanations concise
- Challenge ambiguous prompts. Tell me when I'm wrong!  
