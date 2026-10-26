---
name: java-code-style
description: Use when writing, editing, refactoring or reviewing any Java code (*.java) in this project — Spring Boot controllers, entities, DTOs, mappers, repositories, tests — before touching the code, to apply the project's Java coding conventions.
---

# Java Code Style

- Keep < 120 chars / line
- Keep methods under 30 lines
- Use constructor injection in src/main, `@Autowired` only in tests
- Use `@Transactional` only when strictly necessary to wrap 2+ DB updates
- Global REST exception handling is done via `@RestControllerAdvice`
- Apply `@Validated` on every `@RequestBody`
- Write `equals`/`hashCode`/`toString` to a class only if it actually needs it
