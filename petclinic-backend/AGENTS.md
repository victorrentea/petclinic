# Backend Architecture

**Layered Structure:**
1. REST Controllers (`src/main/java/.../rest/`) - expose API endpoints
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
- DTOs are hand-written (not generated) in `src/main/java/.../rest/dto/`
- `/openapi.yaml` is generated (don't edit it!) from Java DTOs & REST Controllers by `OpenApiExtractorTest`
