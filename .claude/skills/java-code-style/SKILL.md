---
name: java-code-style
description: Java coding rules for this project - method length, constructor injection, @Transactional, @RestControllerAdvice, @Validated, equals/hashCode/toString. Use whenever writing, editing, reviewing, refactoring or testing Java code in this repo (any .java file under petclinic-backend/, petclinic-database/, petclinic-chatbot/ or refactoring-legacy/), before proposing a diff and when reviewing someone else's Java.
---

# Java Code Style

Apply these on the first pass, not after review feedback.

- Keep methods under 30 lines.
- Use constructor injection in `src/main`; `@Autowired` only in tests.
- Use `@Transactional` only when strictly necessary: 2+ DB updates.
- Global REST exception handling is done via `@RestControllerAdvice` — don't try/catch in controllers.
- Apply `@Validated` on every `@RequestBody`.
- Write only the `equals`/`hashCode`/`toString` a class actually needs, not all three reflexively.

## Reviewing Java

When reviewing, flag violations of the rules above as findings, and check the newly
added code follows the same idiom as its neighbours (naming, comment density, layering).
