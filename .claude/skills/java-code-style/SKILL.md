---
name: java-code-style
description: Java code style rules for the petclinic backend and notification-service. Use whenever writing, modifying, or reviewing Java code (line/method length, injection, @Transactional, @Validated, exception handling, equals/hashCode/toString).
---

# Java Code Style

- Keep methods under 30 lines
- Do not add guard clauses to methods unless the call chain can actually bring such data.
- Use constructor injection in src/main, `@Autowired` only in tests
- Use `@Transactional` only when strictly necessary to wrap 2+ DB updates
- Global REST exception handling is done via `@RestControllerAdvice`
- Apply `@Validated` on every `@RequestBody`
- Write `equals`/`hashCode`/`toString` to a class only if it actually needs it
