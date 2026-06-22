# CLAUDE.md — Backend (petclinic-backend/)

Guidance for working in the Spring Boot 3.5 REST API (Java 21).

## Architecture

**Layered Structure:**
1. REST Controllers (`src/main/java/.../rest/`) - expose API endpoints
2. Mappers (`mapper/`) - MapStruct entity↔DTO conversion
3. Repository Layer (`repository/`) - Spring Data JPA interfaces (no service layer!)
4. Domain Model (`model/`) - JPA entities (Owner, Pet, Vet, Visit, Specialty, PetType, User, Role)

**Generated Code:**
- MapStruct mapper implementations → `target/generated-sources/annotations/`
- Regenerate via `./mvnw clean install`

**Data Flow:**
Request → REST Controller → Repository / Mapper → JPA Entity
Response ← REST Controller ← Mapper (Entity→DTO) ← Repository

**Key Patterns:**
- DTOs are hand-written in `src/main/java/.../rest/dto/` (not generated)
- `openapi.yaml` at the repo root is generated output (from `OpenApiExtractorTest`), not a source spec
- Constructor injection (`@RequiredArgsConstructor`), global exception handling via `@RestControllerAdvice`
