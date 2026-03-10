# Code Quality Guidelines

## General Principles
- **KISS**: Keep it simple, implement simplest solution
- **Never overengineer**: Ask before adding optional features
- **Minimal business logic**: Create components with essential fields only
- **DRY for expensive calls**: Avoid repeating repository/service invocations
- **Avoid heavy calls in ternary operators**
- **Prefer `orElseThrow()` over `ifPresent(lambda)`**

## Code Formatting
- Blank lines separate logical blocks / given-when-then sections
- Line length ≤ 120 characters
- IntelliJ IDEA Java code style (default)

## README Guidelines
- Brief, to-the-point for advanced developers
- Precise and concise language
- Never list REST resources in READMEs

## Logging (Backend)
- Use `{}` placeholders in Slf4j (not concatenation)
- Avoid logging sensitive information
- Use snake_case for metric names

## Spring Framework
- Constructor injection (production), `@Autowired` only in tests
- Copy annotations on fields with `lombok.copyableAnnotations+=`
- Bind 2+ related properties with `@ConfigurationProperties`
- Keep `@Transactional` methods fast (no API calls)
- Use `@Transactional` only when strictly necessary
- Use `@Secured`/`@PreAuthorize` at controller layer
- Avoid `@Order` for dependency resolution
- Ask before changing pom.xml
- Use OTEL/opentelemetry for metrics

## REST API
- Java-first (NOT generating from Swagger)
- Mapping logic inside DTOs
- Avoid returning `ResponseEntity<>` from `@RestController`
- Constrain Request DTOs with `@NotNull`, `@NotBlank`, etc.
- All `@RequestBody` should be `@Validated`
- Global `@RestControllerAdvice` + `@ExceptionHandler`
- Report errors using ErrorCode enum in custom exceptions
- Map exceptions to HTTP status codes (400, 404, etc.)
- Consistent error response structure

## Domain Model
- Extract cohesive concepts as Value Object records
- Methods implement simple domain rules on class fields only
- Avoid serialization/presentation concerns in DM

## Lombok (if present)
- `@RequiredArgsConstructor` for dependency injection
- `@Slf4j` for logging
- `@Builder` on immutable objects with ≥5 fields
- `@Value` for private final fields (Java <17)
- Never `@Data` on JPA `@Entity`
- `@Getter`/`@Setter` only when needed (encapsulation)
- If >80% fields need accessors, place on class
- Never use experimental features
- Set `lombok.accessors.chain=true`

## Testing
- `@WebMvcTest(ControllerClass.class)` for controller tests
- `@SpringBootTest` for full integration tests
- Integration tests with `IT` suffix (failsafe plugin)
- Use funny/technical terms from Java ecosystem in examples

## Code Review Priorities
- Correctness and architectural integrity
- Concurrency and transactional issues
- Suggest refactorings (not rewrites)
- Assume Java 21+, Spring Boot 3
- Skip basic explanations
