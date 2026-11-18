---
name: java-code-style
description: Petclinic's Java coding conventions (dependency injection, @Transactional, REST exception handling, validation, equals/hashCode). Use before writing, editing or reviewing any .java file in this repo.
---

# Java Code Style

- Use constructor injection in src/main, `@Autowired` only in tests
- Use `@Transactional` only when strictly necessary to wrap 2+ DB updates
- Global REST exception handling is done via `@RestControllerAdvice`
- Apply `@Validated` on every `@RequestBody`
- Write `equals`/`hashCode`/`toString` to a class only if it actually needs it
