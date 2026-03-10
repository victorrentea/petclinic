---
inclusion: auto
---

# Code Style & Best Practices

## Communication Style
- Keep explanations concise for experienced programmers
- Use bullet lists, numbered lists, and tables for clarity
- Avoid long paragraphs to protect flow
- Challenge ambiguous or incorrect prompts
- Ask questions when unclear, flag contradictions

## Code Formatting
- Line length ≤ 120 characters
- Use blank lines to separate logical blocks
- Default: IntelliJ IDEA Java code style
- Single quotes for TypeScript strings

## Keep It Simple (KISS)
- Implement the simplest possible solution
- Ask before adding enhancements or optional features
- Never overengineer
- Create components with minimal business logic and essential fields only
- Avoid repeating expensive calls (DRY for repository/service invocations)
- Avoid heavy method calls inside ternary operators

## Spring Framework (Backend)
- Use constructor injection for production code
- Use @Autowired only in tests
- Use @RequiredArgsConstructor with lombok.copyableAnnotations+=
- Bind 2+ related properties using @ConfigurationProperties
- Keep @Transactional methods fast (no API calls inside)
- Use @Transactional only when strictly necessary (atomic operations)
- Use @Secured or @PreAuthorize at controller layer
- Avoid @Order annotation for dependency resolution
- Create metrics with OTEL/OpenTelemetry

## REST API Design
- Develop Java-first (not generated from Swagger)
- Implement mapping logic inside DTOs
- Avoid returning ResponseEntity<> from @RestController methods
- Constrain Request DTO fields with @NotNull, @NotBlank, etc.
- Use @Validated on all @RequestBody parameters
- Use global @RestControllerAdvice + @ExceptionHandler
- Report errors using ErrorCode enum in custom exceptions
- Map exceptions to HTTP status codes (400, 404, etc.)
- Define consistent error response structure

## Domain Model
- Extract cohesive concepts as Value Objects (records)
- Methods can implement simple domain rules on own fields only
- Avoid serialization or presentation concerns in domain model

## Lombok (if present)
- Use @RequiredArgsConstructor for dependency injection
- Use @Slf4j for logging
- Use @Builder on immutable objects with ≥5 fields
- Use @Value for classes with only private final fields (Java <17)
- Never use @Data on JPA @Entity
- Use @Getter/@Setter on fields only if needed (encapsulation)
- If >80% fields need accessors, place on class with @Getter(NONE) for exceptions
- Never use experimental Lombok features
- Set lombok.accessors.chain=true in lombok.config

## Logging
- Use placeholders {} in Slf4j messages (not string concatenation)
- Avoid logging sensitive information
- Use snake_case for metric names

## Testing
- Use JUnit 5 (Java) / Jasmine (TypeScript)
- Use package-protected visibility in test classes
- Use AssertJ instead of JUnit assertions
- High functional density: cover more edge cases per test
- Use Mockito for mocking dependencies
- Never mock getters; populate dummy instances instead
- Separate given/when/then with blank lines
- Avoid obvious or redundant comments
- Test names: snake_case or camelCase, pattern <then><when>
- Never use reflection in tests
- Keep tests simple and explicit
- Use @ParameterizedTests for ≥3 data cases
- Avoid trivial tests; keep only essential tests
- Use constants to explain test values
- Use fluent setters when building test data

## Spring Integration Tests
- Use @WebMvcTest(ControllerClass.class) for MVC controllers
- Use @SpringBootTest for full application integration tests
- Integration tests named with IT suffix (failsafe maven plugin)
- Use popular/funny technical terms as test examples

## Code Review Priorities
- Correctness and architectural integrity
- Concurrency and transactional issues
- Suggest refactorings, not rewrites
- Assume Java 21+, Spring Boot 3
