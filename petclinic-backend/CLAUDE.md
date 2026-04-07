# Backend CLAUDE.md

## Commands
```sh
./mvnw spring-boot:run              # Run backend
./mvnw test                         # Unit tests
./mvnw clean install                # Build + generate code (MapStruct, OpenAPI)
./mvnw test -Dtest=ClassName#methodName  # Single test
./postman-tests.sh                  # API tests (Newman)
```

## Architecture

**Layered Structure:**
1. REST Controllers (`src/main/java/.../rest/`) - expose API endpoints
2. Service Layer (`ClinicServiceImpl`) - business logic
3. Repository Layer (`repository/springdatajpa/`) - Spring Data JPA repositories
4. Domain Model (`model/`) - JPA entities (Owner, Pet, Vet, Visit, Specialty, PetType, User, Role)

**Data Flow:**
Request → Controller → Service → Repository → JPA Entity
Response ← Controller ← Mapper (Entity→DTO) ← Service ← Repository

**Key Patterns:**
- DTOs for API contracts (generated from OpenAPI spec at `src/main/resources/openapi.yml`)
- MapStruct mappers → `target/generated-sources/.../mapper/`
- OpenAPI DTOs → `target/generated-sources/.../rest/dto/`
- Regenerate via `mvn clean install`

## Database
- **Default:** H2 in-memory (auto-populated)
  - Console: http://localhost:8080/h2-console (`jdbc:h2:mem:petclinic`, user: `sa`, no password)
- **Alternative:** PostgreSQL via `spring.profiles.active=postgres` + `docker-compose --profile postgres up`

## Security
- Disabled by default
- Enable via `petclinic.security.enable=true`
- Roles: `OWNER_ADMIN`, `VET_ADMIN`, `ADMIN`
- Default user: `admin`/`admin`

## Code Preferences
- Constructor injection for production, `@Autowired` only in tests
- `@Transactional` only when strictly necessary
- MapStruct for DTO mapping
- Global exception handling in `@RestControllerAdvice`
- `@Validated` on `@RequestBody`
- Use Lombok: `@Slf4j`, `@RequiredArgsConstructor`, `@Builder`, `@Getter`/`@Setter` selectively
- Java 21+, Spring Boot 3
