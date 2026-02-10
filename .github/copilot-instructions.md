## Ground Rules 
- keep your explanations concise, I am an experienced programmer
- prefer bullet lists, numbered lists, and tables for higher signal / noise ratio
- avoid long paragraphs of text to protect my flow and save my brain energy
- I might type incorrect or use incorrect words as I often dictate using a voice-to-text tool 
- if my prompt is ambiguous or seems wrong, you MUST challenge it!
- ask questions when unclear, flag contradictions, point out mistakes
- tell me if my instructions don’t make sense
- if a task takes you more than 5 seconds in IntelliJ, play a chime after completing it using `afplay /System/Library/Sounds/Glass.aiff`
- always run all bash commands in background
- if a task involves changing more than 1 file, if there are any pending uncommited changes, ask user if you should commit them first
- if you learn something important about my build environment that can help you later, ask me if I want you to update the  global instructions file, to save time next time
- when I say "fast", "go" or "Sparta" -> don't run any build or tests
- when I say "explain and commit" -> summarize the idea of the change as a training note
- after commit, also push if the Git username is victorrentea and the git repo is under github.com/victorrentea
- when I ask you to refactor, make sure to run the tests 

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

## Clean Java Code
- don't use deprecated apis
- always remove unused imports
- use imports instead of fully qualified class names
- prefer multiple simpler lines to one complex line
- use """ text blocks for any DB query having a JOIN or ≥2 WHERE clauses
- use Java SE APIs over writing custom code
- never use "this" to reference instance fields
- consider records instead of classes with final fields
- add factory methods in records instead of passing null in constructors
- avoid comments - prefer extracting well-named constants, local variables, methods or classes
- comments in code should be applied for: cron expressions and regex patterns
- do not write obvious JavaDoc /** that rephrase code - document the intention, the "why", not implementation details
- use constants to explain magic numbers and strings, or to avoid repeating the same domain value
- decompose complex boolean conditions with explanatory variables
- use descriptive names for classes, methods, and variables
- avoid else statements when not necessary, unless the if is the last statement of the function
- avoid meaningless suffixes: *Impl, *Manager, *Creator, *Factory
- Keep methods small (ideally <=20 lines) and flat (max 3 level of indentation)
- use Cuard Clauses to return or throw early from a function, to reduce the code indentation.
- use explicit type for variables instead of `var` if an explanatory name is too long (>3 words)
- watch out for NullPointerException when the source of data can't be verified (such as coming from a REST payload)
- avoid checked exceptions; if thrown by library code, rethrow them wrapped in a runtime exception
- do not create interfaces implemented by a single class; use classes directly
- create multiple classes only if it decreases complexity and increases readability
- Avoid getter methods starting with "get"; prefer record convention (e.g., name() not getName())
- create well-named methods for coarse-grained, cohesive, self-contained logic
- If a lambda requires multiple statements or braces {}, extract it into a well-named helper method
- Do not create multiline lambda expressions; prefer method references instead
- Extract repeated logic into helper methods (DRY principle)
- Avoid creating empty delegate methods which just call methods without added value
- extract variables to eliminate duplication
- prefer enums over plain Strings for finite, well-defined values
- reuse enum constants as values if possible; enum constants do not have to follow naming conventions
- use try-with-resources instead of explicitly closing resources
- to produce a collection, use Stream instead of a 'for' adding to an empty collection
- prefer .toList() to .collect(Collectors.toList()), if the returned list is not mutated later
- prefer List.of() over new ArrayList<>()
- avoid long Stream chains - after 3-4 operators extract a variable or a method

## Unit Testing
- use JUnit 5
- use package-protected visibility in test classes
- use AssertJ library instead of JUnit assertions
- tests should have a "high functional density": as long as the complexity of the test does not increase, try to cover more edge cases with a single test: eg. test a search with criteria='Ab' to match a value 'xaBy' in the DB with LIKE + UPPER operators.
- use Mockito for mocking dependencies in unit tests
- never mock getters of data structures, populate dummy instances instead
- separate the given/when/then sections of a @Test with empty lines, or add explicit "//when" if test is > 15 lines
- avoid obvious or redundant comments in tests
- test names must not start with 'test' and must be snake_case or camelCase
- test names should follow the pattern <then><when>, eg 'throwsForMissingName'
- never use reflection in tests
- keep tests simple and explicit, do NOT repeat any logic from src/main
- avoid repetitive tests: use @ParameterizedTests for ≥ 3 data cases, including search criteria combinations
- avoid trivial unit tests, only keep essential tests verifying core functionality
- use constants to explain test values such as ids of dummy data
- if available, use fluent setters when building test data

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
