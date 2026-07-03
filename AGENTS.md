# CLAUDE.md

Guidance for AI coding agents (GitHub Copilot CLI, and any `AGENTS.md`-aware tool)
working in this repository.

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

## Development Notes

### Owner's Code Preferences (from copilot-instructions.md)
- Constructor injection for production, `@Autowired` only in tests
- `@Transactional` only when strictly necessary
- MapStruct for DTO mapping
- Global exception handling in `@RestControllerAdvice`
- `@Validated` on `@RequestBody`
- Use only Lombok's `@Slf4j`, `@RequiredArgsConstructor`, `@Builder`, `@Getter`/`@Setter` selectively
- Keep line length ≤ 120 chars
- Never ask before running tests after refactoring
- Builder chains: one property per line, unless only 2 properties total
- For production-scale tables (for example Owners can reach ~1M rows), grids must use server-side pagination and sorting, never client-side.

## Task Modifiers
- Write non-trivial code using TDD
- Keep comments concise, prefer explanatory variable/method names.
- Always run tests after any refactoring
- Keep explanations concise
- Challenge ambiguous prompts. Tell me when I'm wrong!  
