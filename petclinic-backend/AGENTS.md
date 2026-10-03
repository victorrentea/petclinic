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
- `GET /api/owners` is paged (`OwnerPageDto`: `content` + `totalElements`; `sort` takes business keys
  `name|city,asc|desc`, never entity properties). Page the owner ids first, then fetch their pets/visits
  by id: a `Pageable` on a collection fetch join makes Hibernate page in memory after loading every row

