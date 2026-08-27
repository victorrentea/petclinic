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
- `openapi.yaml` at project root is generated output (from `OpenApiExtractorTest`), not a source spec;
  editing it by hand is denied in `.claude/settings.json` — regenerate it instead
- Constructor injection (`@RequiredArgsConstructor`), global exception handling via `@RestControllerAdvice`
- A controller rejecting a request itself throws `ResponseStatusException`, **not** a custom exception:
  `PackagesArchTest` allows `rest` no dependency on `rest.error`, and `docs/packages.puml` is a
  CODEOWNERS-gated file. `ExceptionControllerAdvice` renders it in the same `ProblemDetail` shape as a
  bean-validation failure. Use it for rules the DTO annotations cannot express — one spanning several
  fields, or needing a DB row (e.g. the visit-date range, which is bounded by the pet's birth date)
