---
name: java
description: The owner's Java/Spring code preferences for this repo — injection style, transactions, MapStruct, exception handling, validation, allowed Lombok annotations, formatting. Load BEFORE writing, editing, or reviewing any Java code in this project: creating or changing a controller, repository, entity, DTO, mapper, or test; adding a dependency to a Spring bean; or judging whether existing Java matches house style.
---

# Java code preferences (PetClinic)

Apply these to every Java file you write, edit, or review in this repo.

## Spring wiring

- **Constructor injection** in production code — `@RequiredArgsConstructor` with `private final` fields.
  `@Autowired` is only acceptable in tests.
- **`@Transactional` only when strictly necessary.** Do not sprinkle it on read paths or on
  controllers; it belongs where a write genuinely spans several statements.
- **No service layer.** Controllers talk to repositories and mappers directly — that is deliberate
  in this codebase, so do not "helpfully" introduce one.

## API layer

- **MapStruct for entity↔DTO mapping.** Never hand-roll a converter that MapStruct can generate.
  Implementations land in `target/generated-sources/annotations/`; regenerate with `mvn clean install`.
- **Global exception handling** lives in a `@RestControllerAdvice` — do not add try/catch in
  controllers to shape error responses.
- **`@Validated` on `@RequestBody`** so bean-validation actually runs.

## Lombok — allowlist

Use only these, and only where they earn their place:

| Allowed | Typical use |
|---|---|
| `@Slf4j` | logging |
| `@RequiredArgsConstructor` | constructor injection |
| `@Builder` | multi-field construction in tests/fixtures |
| `@Getter` / `@Setter` | selectively, not blanket on every class |

Anything else (`@Data`, `@AllArgsConstructor`, `@SneakyThrows`, …) is out.

## Formatting

- Line length **≤ 120 chars**.
- **Builder chains: one property per line** — unless the chain sets only 2 properties, which may
  stay on one line.

```java
// 3+ properties → one per line
Owner.builder()
    .firstName("John")
    .lastName("Doe")
    .city("Bucharest")
    .build();

// exactly 2 → one line is fine
PetType.builder().id(1).name("dog").build();
```

## Working style

- Write non-trivial code using **TDD**.
- Prefer explanatory variable and method names over comments; keep any comment short.
- **Run the tests after refactoring — never ask permission first.**
  - whole suite: `mvn test`
  - single test: `mvn test -Dtest=ClassName#methodName`
