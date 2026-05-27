# petclinic-backend

Spring Boot 3.5, Java 21.

## Commands

```sh
mvn test -Dtest=ClassName#methodName   # run single test
mvn clean install                      # build + regenerate MapStruct mappers
```

## Architecture

**Layered Structure:**
1. REST Controllers (`src/main/java/.../rest/`) — expose API endpoints
2. Mappers (`mapper/`) — MapStruct entity↔DTO conversion
3. Repository Layer (`repository/`) — Spring Data JPA (no service layer!)
4. Domain Model (`model/`) — JPA entities (Owner, Pet, Vet, Visit, Specialty, PetType, User, Role)

**Key Patterns:**
- DTOs are hand-written in `src/main/java/.../rest/dto/` (not generated)
- MapStruct mapper implementations → `target/generated-sources/annotations/`
- `openapi.yaml` at project root is generated output (from `OpenApiExtractorTest`), not a source spec
- Constructor injection (`@RequiredArgsConstructor`), global exception handling via `@RestControllerAdvice`

## Database
- **Dev:** Embedded PostgreSQL via `../start-database.sh` (Java jar, localhost:5432)
- **Tests:** Embedded PostgreSQL (auto-started in-process, no setup needed)

## Security
- Disabled by default; enable via `petclinic.security.enable=true`
- Roles: `OWNER_ADMIN`, `VET_ADMIN`, `ADMIN` — default user: `admin`/`admin`

## Domain Model

- **Owner** 1→N **Pet** N→1 **PetType**
- **Pet** 1→N **Visit**
- **Vet** N→N **Specialty** (via `vet_specialties` join table)
- **User** 1→N **Role**

## Code Preferences
- Constructor injection for production, `@Autowired` only in tests
- `@Transactional` only when strictly necessary
- MapStruct for DTO mapping
- Global exception handling in `@RestControllerAdvice`
- `@Validated` on `@RequestBody`
- Use Lombok: `@Slf4j`, `@RequiredArgsConstructor`, `@Builder`, `@Getter`/`@Setter` selectively
- Keep line length ≤ 120 chars
- Never ask before running tests after refactoring
- Builder chains: one property per line, unless only 2 properties total
