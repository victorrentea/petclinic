# Backend — CLAUDE.md

Scoped guidance for `petclinic-backend/` (Spring Boot 3.5 REST API, Java 21).
Auto-loaded by the harness whenever a file in this module is read or written.

## Backend Architecture

**Layered Structure:**
1. REST Controllers (`src/main/java/.../rest/`) - expose API endpoints
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
- project-root `openapi.yaml` is generated output (from `OpenApiExtractorTest`), not a source spec
- Constructor injection (`@RequiredArgsConstructor`), global exception handling via `@RestControllerAdvice`

> Java coding style for this module lives in the `java-style` skill (lazy-loaded when writing/reviewing Java).
