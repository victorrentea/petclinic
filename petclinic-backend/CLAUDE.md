# CLAUDE.md

## Architecture

**Layered Structure:**
1. REST Controllers (`src/main/java/.../rest/`) - expose API endpoints
2. Mappers (`mapper/`) - MapStruct entity↔DTO conversion
3. Repository Layer (`repository/`) - Spring Data JPA interfaces (no service layer!)
4. Domain Model (`model/`) - JPA entities (Owner, Pet, Vet, Visit, Specialty, PetType, User, Role)

**Key Patterns:**
- No service layer — controllers call repositories directly
- DTOs are hand-written in `src/main/java/.../rest/dto/` (not generated)
- `openapi.yaml` at project root is generated output (from `OpenApiExtractorTest`), not a source spec
- MapStruct mapper implementations → `target/generated-sources/annotations/`; regenerate via `./mvnw clean install`

## Database
- **Tests:** Embedded PostgreSQL auto-starts in-process — no setup needed
- **Dev:** `./start-database.sh` (localhost:5432)

## Security
- Disabled by default; enable via `petclinic.security.enable=true`
- Default user: `admin`/`admin`

## Commands
```sh
./mvnw test                         # Run all tests
./mvnw test -Dtest=ClassName#methodName  # Run single test
./mvnw clean install                # Build + regenerate MapStruct mappers
```
