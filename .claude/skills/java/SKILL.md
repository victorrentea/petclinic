---
name: java
description: PetClinic backend Java code-style and conventions (constructor injection, @Transactional, MapStruct, @RestControllerAdvice, @Validated, Lombok, line length, builder chains). Use whenever writing, editing, or reviewing Java files under petclinic-backend/ (petclinic-backend/**/*.java).
paths: petclinic-backend/**/*.java
---

# Java Code Style (PetClinic backend)

These rules apply only when writing or reviewing `.java` files under
`petclinic-backend/`. They are the owner's code preferences (originally from
`copilot-instructions.md`).

## Rules

- Constructor injection for production, `@Autowired` only in tests
- `@Transactional` only when strictly necessary
- MapStruct for DTO mapping
- Global exception handling in `@RestControllerAdvice`
- `@Validated` on `@RequestBody`
- Use only Lombok's `@Slf4j`, `@RequiredArgsConstructor`, `@Builder`, `@Getter`/`@Setter` selectively
- Keep line length ≤ 120 chars
- Never ask before running tests after refactoring
- Builder chains: one property per line, unless only 2 properties total
