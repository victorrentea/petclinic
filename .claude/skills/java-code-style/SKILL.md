---
name: java-code-style
description: This project's Java code style. Read BEFORE writing, editing, refactoring or reviewing any .java file, for any change — new class, method, REST controller, entity, DTO or test.
---

- Keep methods under 30 lines
- Use constructor injection in src/main, `@Autowired` only in tests
- Use `@Transactional` only when strictly necessary to wrap 2+ DB updates
- Global REST exception handling is done via `@RestControllerAdvice`
- Apply `@Validated` on every `@RequestBody`
- Write `equals`/`hashCode`/`toString` to a class only if it actually needs it
