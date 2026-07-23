---
name: java
description: The owner's Java coding style for this repo — dependency injection, transactions, MapStruct mapping, exception handling, request validation, Lombok usage, and builder-chain formatting. Apply whenever writing, editing, or reviewing Java source in petclinic-backend, petclinic-chatbot, or petclinic-database.
when_to_use: Any task that touches a `.java` file — adding a controller/repository/entity, refactoring backend code, writing a backend test, or reviewing a Java diff.
paths: "**/*.java"
---

# Java code style (owner's preferences)

These are the owner's standing rules for Java in this repo. Follow them without asking; flag it
only if a rule genuinely can't be met.

## Dependency injection

- **Constructor injection in production code** — use Lombok's `@RequiredArgsConstructor` over
  `private final` fields.
- `@Autowired` is allowed **only in tests**.

## Transactions

- `@Transactional` **only when strictly necessary** — i.e. when more than one write must commit
  or roll back together. Do not sprinkle it on read paths or on single-repository-call methods.

## Mapping

- **MapStruct** for every entity ↔ DTO conversion. No hand-written mapping methods.
- Mapper implementations are generated into `target/generated-sources/annotations/`; regenerate
  with `mvn clean install` after changing a mapper interface or a DTO.

## REST layer

- **Global exception handling** lives in a `@RestControllerAdvice` — do not catch-and-translate
  exceptions inside controllers.
- Put `@Validated` on `@RequestBody` parameters so bean validation actually runs.

## Lombok

Use **only** these, and selectively — not blanket-applied to every class:

| Annotation | Use for |
|---|---|
| `@Slf4j` | logging |
| `@RequiredArgsConstructor` | constructor injection |
| `@Builder` | building value objects / test fixtures |
| `@Getter` / `@Setter` | only on the fields or classes that need them |

Anything else (`@Data`, `@AllArgsConstructor`, `@SneakyThrows`, …) is out.

## Builder chains

One property per line — **unless** the chain has only 2 properties, which stays on one line.

```java
// 3+ properties: one per line
Owner.builder()
    .firstName("John")
    .lastName("Doe")
    .city("Cluj")
    .build();

// exactly 2: keep it inline
PetType.builder().id(1).name("cat").build();
```

## Testing

- Write non-trivial code using **TDD**.
- Run the tests after any refactoring — never ask permission first.
  Single test: `mvn test -Dtest=ClassName#methodName`.
