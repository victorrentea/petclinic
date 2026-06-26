---
name: java-style
description: Use when writing, editing, or reviewing Java code in the PetClinic backend — the project's Java conventions for Lombok, MapStruct, constructor injection, transactions, validation, line length, and builder formatting.
---

# PetClinic Java Style

Coding conventions for Java in `petclinic-backend/`. Apply when authoring or
reviewing Java; flag diffs that violate these.

## Conventions

- Constructor injection for production code; `@Autowired` only in tests.
- `@Transactional` only when strictly necessary.
- MapStruct for entity↔DTO mapping (no hand-rolled mapping loops).
- Global exception handling in a `@RestControllerAdvice`.
- `@Validated` on `@RequestBody`.
- Use Lombok: `@Slf4j`, `@RequiredArgsConstructor`, `@Builder`, `@Getter`/`@Setter` selectively.
- Keep line length ≤ 120 chars.
- Never ask before running tests after refactoring.
- Builder chains: one property per line, unless only 2 properties total.

## Builder formatting example

```java
// 2 properties → single line is fine
var type = PetType.builder().id(1).name("dog").build();

// 3+ properties → one per line
var owner = Owner.builder()
    .firstName("George")
    .lastName("Franklin")
    .city("Madison")
    .build();
```
