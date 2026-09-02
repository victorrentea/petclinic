### Backend Architecture

**Layered Structure:**
1. REST Controllers (`petclinic-backend/src/main/java/.../rest/`) - expose API endpoints
2. Mappers (`mapper/`) - MapStruct entity↔DTO conversion
3. Repository Layer (`repository/`) - Spring Data JPA interfaces (no service layer!)
4. Domain Model (`domain/`) - JPA entities (Owner, Pet, Vet, Visit, Specialty, PetType, User, Role)

Two packages sit outside that stack:
- `security/` - Spring Security config, off unless `petclinic.security.enable=true`
- `mcp/` - `PetClinicMcp` (`@Tool`s exposed at `/mcp`, consumed by `petclinic-chatbot`) + its Tomcat/security customizers

**Generated Code:**
- MapStruct mapper implementations → `target/generated-sources/annotations/`
- Regenerate via `mvn clean install`

**Data Flow:**
Request → REST Controller → Repository / Mapper → JPA Entity
Response ← REST Controller ← Mapper (Entity→DTO) ← Repository

**Test styles, deliberately contrasted on the same logic:** `create_visit` (the most rule-heavy
method here — ownership, past date, past time, abuse cap, persist) is covered twice on purpose.
`CreateVisitToolTest` is flat and `@SpringBootTest` (~14s); `CreateVisitShould` is hierarchical
(`@Nested` + `@DisplayNameGeneration(PrettyTestNames.class)`, in `tools/`) and a social unit test —
real `PetClinicMcp`, only the repositories mocked, no Spring, no DB (~0.3s). The duplication is the
lesson: run both and read the two trees side by side. Keep them in sync when the rules change.

**Key Patterns:**
- DTOs are hand-written in `src/main/java/.../rest/dto/` (not generated)
- `openapi.yaml` at project root is generated output (from `OpenApiExtractorTest`), not a source spec
- Constructor injection (`@RequiredArgsConstructor`), global exception handling via `@RestControllerAdvice`
