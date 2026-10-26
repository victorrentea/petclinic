# Architecture decisions

Settled choices, with the context that made them right. Don't undo one as a side effect
of a task — if its context no longer holds, say so and ask.

| Decision | Why, in this context | Rejected |
| --- | --- | --- |
| No service layer: controllers call repositories and mappers directly | Almost every use case is CRUD with no business logic, so a service layer would just pass calls through | Controller → Service → Repository everywhere; add a service only for a use case with real logic or 2+ writes |
| Postgres runs embedded (zonky jar in dev, in-process in tests), no Docker | Trainees' laptops often have no Docker, or a corporate policy blocks it; the app must start with Java alone | Testcontainers, docker-compose |
| Notifying the owner is best effort: an HTTP POST to notification-service after the visit is saved; a failure is logged, the booking stands | An SMS outage must not stop the clinic from booking visits | Sending in the same transaction; a message broker (one more thing to run in a training room) |

## Backend Architecture

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
- DTOs are hand-written (not generated) in `src/main/java/.../rest/dto/`
- `/openapi.yaml` is generated (don't edit it!) from Java DTOs & REST Controllers by `OpenApiExtractorTest`
