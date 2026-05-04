---
name: java
description: >
  Java/Spring code preferences for the PetClinic backend.
  Invoke BEFORE writing or editing any *.java file under petclinic-backend/, or when
  the user asks to add/refactor a controller, service, repository, mapper, JPA entity,
  or any Spring component. Also invoke when explicitly asked via /java.
---

# Java / Spring Code Preferences (PetClinic backend)

Apply these rules **on the first pass** when writing or editing Java code under `petclinic-backend/`. These are this project's conventions — do not deviate without an explicit reason.

## Stack
- Java 21+
- Spring Boot 3
- Spring Data JPA (no service layer between controller and repository)
- MapStruct for entity↔DTO mapping
- Lombok for boilerplate reduction

## Dependency Injection
- **Constructor injection** in production code — use Lombok `@RequiredArgsConstructor` on the class with `private final` fields
- `@Autowired` is allowed **only in tests**
- Never use field injection (`@Autowired` on a field) in production

## Transactions
- `@Transactional` **only when strictly necessary** (multi-statement writes that must be atomic, or read transactions that need consistency)
- Do not annotate every service method by default

## REST Layer
- DTOs come from the OpenAPI spec at `src/main/resources/openapi.yml` (generated under `target/generated-sources/`)
- `@Validated` on `@RequestBody` parameters
- Global exception handling via a `@RestControllerAdvice`
- Never expose JPA entities directly through the API — always map via MapStruct

## Lombok Usage

See [Lombok.md](Lombok.md) for full annotation guidelines. Load it when adding/reviewing Lombok annotations.

## Code Style
- **Builder chains: one method call per line, unless only 2 properties total.** `>2` chained calls on a single line is a violation. (Enforced by the user — fix proactively.)
- **Line length ≤ 120 chars.** Enforced by `.githooks/pre-commit` on staged `*.java` lines.

## Testing
- TDD always: write a failing test first, confirm it fails, then implement.
- JUnit 5 + AssertJ.
- For Spring integration tests, follow patterns in existing tests (e.g. `PetTest.java`, `OwnerTest.java`).

## Don'ts
- Don't return `Stream` from public methods — return `List` instead. (`Stream` only for genuinely huge data sets.)
- Don't use ternary operators that don't fit in roughly half a line — use `if/else`.
- Don't add a service layer "just in case" — controllers may call repositories directly.
- Don't load entire collections into memory at scale (e.g. all owners) — paginate + filter at the DB level.