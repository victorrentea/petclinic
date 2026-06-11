# Backend conventions (petclinic-backend/)

Module-scoped guidance for the Spring Boot backend (Java 21, Spring Boot 3.5). The harness
loads this automatically whenever you touch files under `petclinic-backend/`. Patterns are
extracted from the existing code — read one sibling file before adding a new one to calibrate.

## Architecture: no service layer

```
Request → @RestController → Mapper (MapStruct) + Repository (Spring Data) → JPA Entity
Response ←     DTO        ← Mapper                ← Repository              ← Entity
```

There is **no service layer**. Controllers call repositories and mappers directly.
Don't introduce `@Service` classes unless explicitly asked.

Packages (under `victor.training.petclinic`): `rest/`, `rest/dto/`, `rest/error/`,
`mapper/`, `repository/`, `model/`, `mcp/`, `security/`.
`PackagesArchTest` enforces these deps against `docs/packages.puml` — adding a new
subpackage or cross-package dependency fails that guardrail until the diagram is updated.

## Controllers (`rest/`)

```java
@RestController
@RequestMapping("/api/owners")
@RequiredArgsConstructor
@PreAuthorize("hasRole(@roles.OWNER_ADMIN)")
public class OwnerRestController {
    private final OwnerRepository ownerRepository;
    private final OwnerMapper ownerMapper;

    @Operation(operationId = "getOwner", summary = "Get an owner by ID")
    @GetMapping("/{ownerId}")
    public OwnerDto getOwner(@PathVariable int ownerId) {
        Owner owner = ownerRepository.findById(ownerId).orElseThrow();
        return ownerMapper.toOwnerDto(owner);
    }

    @Operation(operationId = "addOwner", summary = "Create an owner")
    @PostMapping(consumes = "application/json")
    public ResponseEntity<Void> addOwner(@RequestBody @Validated OwnerFieldsDto dto) {
        Owner owner = ownerMapper.toOwner(dto);
        ownerRepository.save(owner);
        URI uri = UriComponentsBuilder.newInstance()
            .path("/api/owners/{id}").buildAndExpand(owner.getId()).toUri();
        return ResponseEntity.created(uri).build();
    }
}
```

Rules:
- Constructor injection via `@RequiredArgsConstructor` + `private final` fields. Never `@Autowired` fields.
- Every endpoint gets `@Operation(operationId = "...", summary = "...")` — drives `openapi.yaml`.
- `@PreAuthorize` at class level; override per-method (e.g. `permitAll()`) when needed.
- Request bodies: `@RequestBody @Validated XFieldsDto`. Responses: `XDto`.
- `findById(id).orElseThrow()` — the bare `NoSuchElementException` maps to **404** via the advice.
- POST that creates → `ResponseEntity.created(uri)`. PUT/DELETE → `void` (200).
- `@Transactional` (jakarta) **only when strictly necessary** — i.e. multiple writes or lazy
  access in one request (see `addPetToOwner`). Not on simple single-repo calls.
- Keep ≤ 5 constructor params where reasonable — SonarCloud `java:S107` is capped at 5 and
  fails the quality gate on new code.

## DTOs (`rest/dto/`) — hand-written, two flavors

- `XDto` — response shape: includes `id` (read-only) and nested collections (`@Valid`).
- `XFieldsDto` — request body: the writable fields only, **no id**.

```java
@Data
public class OwnerFieldsDto {
    @NotNull @Size(min = 1, max = 30)
    @Schema(example = "\"George\"", description = "The first name of the pet owner.")
    private String firstName;
    // ...
}
```

- `@Data` (Lombok) + jakarta validation annotations + `@Schema` on every field (OpenAPI docs).
- Read-only fields: `@Schema(accessMode = Schema.AccessMode.READ_ONLY)`.
- DTOs are **not** generated — write them by hand. `openapi.yaml` is generated *from* them.

## Mappers (`mapper/`) — MapStruct

```java
@Mapper(componentModel = "spring", uses = PetMapper.class)
public interface OwnerMapper {
    OwnerDto toOwnerDto(Owner owner);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "pets", ignore = true)
    Owner toOwner(OwnerFieldsDto dto);

    List<OwnerDto> toOwnerDtoCollection(List<Owner> owners);
}
```

- `componentModel = "spring"`; compose with `uses = OtherMapper.class`.
- `@Mapping(target = ..., ignore = true)` for `id` and relationships set elsewhere.
- Implementations are generated into `target/generated-sources/`. After changing a mapper
  interface, run `./mvnw clean install` (not just `test`) to regenerate, or the build breaks.

## Repositories (`repository/`) — Spring Data, minimal surface

```java
public interface OwnerRepository extends Repository<Owner, Integer> {
    List<Owner> findByLastNameStartingWith(String lastName);
    Optional<Owner> findById(int id);

    @Query("SELECT o FROM Owner o LEFT JOIN FETCH o.pets WHERE o.id = :id")
    Optional<Owner> findByIdFetchingPets(int id);

    Owner save(Owner owner);
    void delete(Owner owner);
}
```

- Extend the bare `Repository<T, Id>` and declare **only the methods used** — not `JpaRepository`.
- Derived query methods first; drop to `@Query` JPQL for fetch-joins / custom logic.
- Avoid N+1: use `LEFT JOIN FETCH` when you need a collection eagerly.
- **Scale matters (100k+ owners): never load all rows into memory.** Paginate and filter at the
  DB level (`Pageable`, `WHERE`), prefer `EXISTS` over `JOIN ... DISTINCT`, and `ILIKE` + `pg_trgm`
  for fuzzy search. Don't `findAll()` an unbounded table.

## Error handling (`rest/error/`)

Global `@RestControllerAdvice(basePackages = "victor.training.petclinic.rest")` returning
RFC-7807 `ProblemDetail`. **Keep it package-scoped** — it must NOT catch MCP (`/mcp`) errors,
which the Streamable-HTTP transport serializes into JSON-RPC itself. Don't widen the basePackages
or add a second advice over the MCP endpoint (`McpHttpSecurityTest` guards that boundary).

## Tests — TDD for non-trivial logic

REST integration test:
```java
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
public class OwnerTest {
    @Autowired MockMvc mockMvc;
    @Autowired OwnerRepository ownerRepository;
    // ... seed via repositories, exercise via mockMvc.perform(...), assert with jsonPath + AssertJ
}
```

- Stack: JUnit 5, MockMvc, AssertJ (`assertThat`), embedded Postgres (Zonky, in-process — no setup).
- `@Transactional` on the test class rolls back between tests.
- Functional/BDD: Cucumber steps in `test/.../functional/` using RestAssured + `JdbcTemplate` seeding.
- Write a failing test first for real logic; skip ceremony tests for cosmetic/mechanical edits.
- **Never ask before running tests after a refactor** — just run `./mvnw test`.

## Guardrails that bite — regenerate before committing

Editing entities, DTOs, endpoints, or packages drifts generated artifacts. `./mvnw test`
regenerates them and the pre-commit hook auto-stages; CI fails on drift otherwise:
- `../openapi.yaml` (repo root) ← any controller/DTO change (`OpenApiExtractorTest`)
- `docs/generated/DomainModel.puml` ← `@Entity` changes (`DomainModelExtractorTest`)
- DB schema: new entity columns need a migration in `src/main/resources/db/migration/`, or
  `JpaMatchesDBSchemaTest` (ddl-auto=validate) fails context refresh; `DbSchemaExtractorTest`
  re-dumps the schema snapshot
- `petclinic-frontend/.../api-types.ts` ← regenerated from `openapi.yaml`
- Javadoc gate: no unresolved `{@link ...}` — `mvn javadoc:javadoc -DfailOnError=true` runs in CI

Several of these paths are CODEOWNERS-protected (`openapi.yaml`, `db/migration/`, `docs/*.puml`,
`**/pom.xml`) — expect an Elders review and a settings.json "ask" before editing.

## House style

- Java indent = **4 spaces** (`.editorconfig` overrides the editor default). Lines ≤ 120 chars —
  Checkstyle (`checkstyle.xml`) runs in the Maven `validate` phase and **fails the build** on any
  main- or test-source line > 120 chars.
- Lombok selectively: `@RequiredArgsConstructor`, `@Slf4j`, `@Data`/`@Getter`/`@Setter`, `@Builder`.
  Builder chains: one property per line, unless there are only 2 properties total.
- No ternary unless it fits in ~half a line (≤ ~60 chars) — otherwise `if/else`.
- Don't return `Stream` from methods — return `List` (Stream only for humongous data).
- Inner enums over top-level for tiny, locally-used enums.
- Prefer explanatory names over comments; keep comments concise.

## Commands (run from petclinic-backend/)

```sh
./mvnw test                              # run tests (regenerates drift artifacts)
./mvnw test -Dtest=OwnerTest#methodName  # single test
./mvnw clean install                     # build + regenerate MapStruct mappers
./mvnw spring-boot:run                   # run backend on :8080 (also hosts MCP at /mcp)
```
