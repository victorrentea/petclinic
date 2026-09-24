---
name: java-code-style
description: Java code style rules for this repo — method length, dependency injection, @Transactional, REST exception handling, @Validated request bodies, equals/hashCode/toString. Use whenever writing, editing, refactoring or reviewing Java code (petclinic-backend, notification-service, petclinic-commons, petclinic-chatbot).
---

# Java code style

- Keep methods under 30 lines (to prevent GI⇒GO)
- Use constructor injection in src/main, `@Autowired` only in tests
- Use `@Transactional` only when strictly necessary: 2+ DB updates
- Global REST exception handling is done via `@RestControllerAdvice`
- Apply `@Validated` on every `@RequestBody`
- Write only the `equals`/`hashCode`/`toString` a class actually needs, not all three reflexively
