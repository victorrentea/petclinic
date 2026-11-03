---
description: "Use for Java files in this repository. Covers Java code style, dependency injection, transactions, REST validation, and entity methods."
applyTo: "**/*.java"
---

# Java Code Style

- Keep methods under 30 lines.
- Use constructor injection in `src/main`; use `@Autowired` only in tests.
- Use `@Transactional` only when strictly necessary to wrap two or more database updates.
- Global REST exception handling is done via `@RestControllerAdvice`.
- Apply `@Validated` on every `@RequestBody`.
- Add `equals`, `hashCode`, or `toString` only when a class actually needs them.
