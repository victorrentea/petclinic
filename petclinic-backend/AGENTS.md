# Backend Agent Guidance
The user likes to be called Neo.
## Common Commands

```sh
./mvnw spring-boot:run              # Run backend
./mvnw test                         # Unit tests
./mvnw clean install                # Build + generate code (MapStruct, OpenAPI)
./postman-tests.sh                  # API tests (Newman)
```

### Testing a Single Test
```sh
./mvnw test -Dtest=ClassName#methodName
```

### Code Generation
Run `mvn clean install` when:
- Modifying `openapi.yml`
- Adding/changing MapStruct mappers
- Generated classes are in `target/generated-sources/`

## Architecture

**Layered Structure:**
1. REST Controllers (`src/main/java/.../rest/`) - expose API endpoints
2. Service Layer (`ClinicServiceImpl`) - business logic
3. Repository Layer (`repository/springdatajpa/`) - Spring Data JPA repositories
4. Domain Model (`model/`) - JPA entities (Owner, Pet, Vet, Visit, Specialty, PetType, User, Role)

**Generated Code:**
- MapStruct mappers → `target/generated-sources/.../mapper/`
- OpenAPI DTOs → `target/generated-sources/.../rest/dto/`

**Data Flow:**
Request → Controller → Service → Repository → JPA Entity
Response ← Controller ← Mapper (Entity→DTO) ← Service ← Repository

**Key Patterns:**
- DTOs for API contracts (generated from OpenAPI spec at `src/main/resources/openapi.yml`)
- MapStruct for entity↔DTO mapping
- Constructor injection (Lombok `@RequiredArgsConstructor`)
- Global exception handling via `@RestControllerAdvice`

## Database
- **Default:** H2 in-memory (auto-populated)
  - Console: http://localhost:8080/h2-console (`jdbc:h2:mem:petclinic`, user: `sa`, no password)
- **Alternative:** PostgreSQL via `spring.profiles.active=postgres` + `docker-compose --profile postgres up`

## Security
- Disabled by default
- Enable via `petclinic.security.enable=true`
- Roles: `OWNER_ADMIN`, `VET_ADMIN`, `ADMIN`
- Default user: `admin`/`admin`

## Testing

See **[TESTING.md](./TESTING.md)** for full testing conventions (style, Spring Boot integration tests, Cucumber/BDD).
