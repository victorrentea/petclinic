## Ground Rules 
- keep your explanations concise, I am an experienced programmer
- prefer bullet lists, numbered lists, and tables for higher signal / noise ratio
- avoid long paragraphs of text to protect my flow and save my brain energy
- I might type incorrect or use incorrect words as I often dictate using a voice-to-text tool 
- if my prompt is ambiguous or seems wrong, you **MUST** challenge it!
- ask questions when unclear, flag contradictions, point out mistakes
- tell me if my instructions don’t make sense

- if a task takes you more than 5 seconds in IntelliJ, play a chime after completing it using `afplay /System/Library/Sounds/Glass.aiff`
- if a task involves changing more than 1 file, if there are any pending uncommited changes, ask user if you should commit them first
- if you learn something important about my build environment that can help you later, ask me if I want you to update the  global instructions file, to save time next time

## Victor's Personal Preferences
- when I say "fast", "go" or "Sparta" -> don't run any build or tests
- when I say "explain and commit" -> summarize the idea of the change as a training note
- after commit, also push if the Git username is victorrentea and the git repo is under github.com/victorrentea
- when I ask to push and there are no pending changes, commit any pending changes first
- when I ask you to refactor, make sure to run the tests 
- when I tell you to remember a certain ground rule, update .githun/copilot-instructions.md or specialized .github/instructions/*.md files with that rule

## Code Formatting
- use blank lines to separate logical blocks of code, or given/when/then sections of a @Test
- line length ≤ 120 characters
- default code style: IntelliJ IDEA Java code style.

## Keep It Simple (KISS)
- keep code simple and concise
- always implement the simplest possible solution
- Ask before implementing enhancements or optional features
- Never overengineer; ask about adding optional features or extension points
- Create new components with minimal business logic and essential fields only
- avoid repeating expensive calls; apply DRY to repository/service invocations
- avoid heavy method calls inside ternary operators


## README Guidelines
- write brief, 'to the point' README.md files for advanced developers
- use precise and concise language
- never list REST resources in READMEs

## Logging
- use placeholders `{}` in Slf4j log messages instead of string concatenation
- avoid logging sensitive information
- use snake_case names for metrics

## Spring Framework
- Use constructor injection for production code, and @Autowired only in tests.
- Copy any annotations on fields in the generated @RequiredArgsConstructor using lombok.copyableAnnotations+=
- Bind 2+ related properties to an object using @ConfigurationProperties.
- Keep @Transactional methods fast: for example, they shouldn't do API calls.
- @Transactional should be used only when strictly necessary, to make atomic 2 repo.save, or 1 repo.save + one update.
- Use @Secured or @PreAuthorize: at the controller layer when using Spring Security to enforce method-level security.
- Avoid `@Order` annotation for dependency resolution.
- always ask before changing pom.xml
- create metrics and observability features with OTEL / opentelemetry

## REST API
- the REST APIs called by a SPA should be developed Java-first (ie. NOT generating Java code from a swagger)
- mapping logic to/from domain objects should be implemented inside Dtos .
- avoid returning ResponseEntity<> from @RestController methods.
- Fields of Request Dtos should generally be constrained with annotations like @NotNull, @NotBlank, ...
- All @RequestBody parameters should be @Validated.
- Use a global @RestControllerAdvice + @ExceptionHandler to handle common exceptions.
- Report to client the cause of an application error using an ErrorCode enum, carried inside a custom runtime exception, handled in @RestControllerAdvice.
- Map exceptions to appropriate HTTP status codes in REST controllers, for example: MethodArgumentNotValidException->400, NoSuchElementException->404.
- Define a consistent error response structure.

## Spring Integration Tests
- use @WebMvcTest(ControllerClass.class) for testing Spring MVC controllers
- use @SpringBootTest for integration tests traversing the entire application
- integration tests are named with IT suffix and are executed by the failsafe maven plugin.
- use popular, also funny, technical terms from Java ecosystem and IT in general as examples in unit tests.

## Domain Model
- Extracting cohesive domain concepts as new Value Objects records (eg. ShippingAddress)
- Methods in Domain Model classes can implement simple domain rules operating only on that class' fields
- Avoid adding serialization or presentation concerns in DM

## Lombok (if present in classpath)
- use @RequiredArgsConstructor to generate constructors for injecting dependencies
- use @Slf4j Lombok for logging instead of manually defined field
- use @Builder on any immutable object with >= 5 fields
- use @Value for classes having only private final fields, if java version < 17
- never use @Data on a JPA @Entity
- use @Getter and @Setter on fields instead of writing accessors, but ONLY if that accessor is needed (encapsulation)
- if >80% of fields of a class require @Getter or @Setter, place it on the class, using eg @Getter(NONE) for those not fields not needing it
- never use any experimental Lombok feature
- set lombok.accessors.chain=true in lombok.config
