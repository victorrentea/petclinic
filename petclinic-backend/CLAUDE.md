# Backend (Spring Boot / Java 21)

## Commands
```sh
./mvnw test                              # Run tests
./mvnw test -Dtest=ClassName#methodName  # Single test
./mvnw clean install                     # Build + regenerate MapStruct mappers
```

## Architecture

**Layered structure (no service layer):**
1. REST Controllers (`src/main/java/.../rest/`) — expose API endpoints
2. Mappers (`mapper/`) — MapStruct entity↔DTO conversion
3. Repository Layer (`repository/`) — Spring Data JPA interfaces
4. Domain Model (`model/`) — JPA entities (Owner, Pet, Vet, Visit, Specialty, PetType, User, Role)

**Key patterns:**
- DTOs hand-written in `src/main/java/.../rest/dto/`
- `openapi.yaml` at project root is **generated** output (from `OpenApiExtractorTest`), not a source spec
- Constructor injection (`@RequiredArgsConstructor`), global exception handling via `@RestControllerAdvice`
- MapStruct mapper implementations → `target/generated-sources/annotations/` (regenerate via `./mvnw clean install`)

**Data flow:**
Request → REST Controller → Repository / Mapper → JPA Entity
Response ← REST Controller ← Mapper (Entity→DTO) ← Repository

## Code Preferences
- MapStruct for DTO mapping
- Lombok: `@Slf4j`, `@RequiredArgsConstructor`, `@Builder`, `@Getter`/`@Setter` selectively
- Global exception handling in `@RestControllerAdvice`
- Keep line length ≤ 120 chars
- Builder chains: one property per line, unless only 2 properties total
- Avoid ternary unless it fits in half a line (~60 chars); use if/else otherwise
