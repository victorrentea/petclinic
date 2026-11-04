---
name: java-code-style
description: Java and Spring Boot coding conventions for petclinic-backend (method length, DI, @Transactional, REST validation/exception handling, equals/hashCode/toString). Use whenever writing, editing, refactoring, or reviewing Java code in petclinic-backend/ or notification-service/.
---

# Java Code Style

- Keep methods under 30 lines
- Use constructor injection in `src/main`, `@Autowired` only in tests
- Use `@Transactional` only when strictly necessary to wrap 2+ DB updates
- Global REST exception handling is done via `@RestControllerAdvice`
- Apply `@Validated` on every `@RequestBody`
- Write `equals`/`hashCode`/`toString` to a class only if it actually needs it
