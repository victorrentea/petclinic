### Backend Architecture

**Layered Structure:**
1. REST Controllers (`petclinic-backend/src/main/java/.../rest/`) - expose API endpoints
2. Mappers (`mapper/`) - hand-written `@Component` entity↔DTO conversion
3. Repository Layer (`repository/`) - Spring Data JPA interfaces (no service layer!)
4. Domain Model (`domain/`) - JPA entities (Owner, Pet, Vet, Visit, Specialty, PetType, User, Role)
5. Notification (`notification/`) - `NotificationServiceClient`, called after a visit is booked:
   an HTTP POST to notification-service, best effort (a failure is logged, the booking stands).
   Takes plain values, never an entity, and reaches no repository

**Data Flow:**
Request → REST Controller → Repository / Mapper → JPA Entity
Response ← REST Controller ← Mapper (Entity→DTO) ← Repository

**Key Patterns:**
- DTOs are hand-written in `src/main/java/.../rest/dto/` (not generated)
- `openapi.yaml` at project root is generated output (from `OpenApiExtractorTest`), not a source spec;
  editing it by hand is denied in `.claude/settings.json` — regenerate it instead
- Constructor injection, global exception handling via `@RestControllerAdvice`
- `GET /api/owners` is paged: it returns `{content, totalElements}`, `size` is 5/10/20 and `sort` takes business keys
  (`name|city`,`asc|desc`), never entity fields. Pets and visits load in a second query by the page's IDs —
  a fetch join under a LIMIT would page in memory
