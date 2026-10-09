---
name: java-code-style
description: PetClinic's Java code style rules. Use whenever writing, editing, reviewing or refactoring Java code in any module of this repo (backend, notification-service, commons, database).
paths: ["**/*.java"]
---

# Java Code Style

- Keep methods under 30 lines
- Use constructor injection in src/main, `@Autowired` only in tests
- Use `@Transactional` only when strictly necessary: 2+ DB updates
- Global REST exception handling is done via `@RestControllerAdvice`
- Apply `@Validated` on every `@RequestBody`
- Write only the `equals`/`hashCode`/`toString` a class actually needs, not all three reflexively
