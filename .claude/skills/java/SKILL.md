---
name: java
description: >
  Owner's Java code conventions for the PetClinic Spring Boot backend.
  Use when editing or reviewing any Java code in this project — controllers, mappers,
  repositories, entities, DTOs, or tests under petclinic-backend/. Covers injection,
  transactions, MapStruct, exception handling, Lombok, line length, and builder style.
---

# Java Code Preferences (PetClinic backend)

Owner's conventions (from `copilot-instructions.md`). Apply these proactively when writing or reviewing Java in this repo.

- Constructor injection for production, `@Autowired` only in tests
- `@Transactional` only when strictly necessary
- MapStruct for DTO mapping
- Global exception handling in `@RestControllerAdvice`
- `@Validated` on `@RequestBody`
- Use Lombok: `@Slf4j`, `@RequiredArgsConstructor`, `@Builder`, `@Getter`/`@Setter` selectively
- Keep line length ≤ 120 chars
- Never ask before running tests after refactoring
- Builder chains: one property per line, unless only 2 properties total
