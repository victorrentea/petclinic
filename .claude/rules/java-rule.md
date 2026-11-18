---
# Loaded when Claude reads/edits a matching file (Read/Edit/Write, or cat/head on it) — not on mvn/grep.
paths: ["**/*.java"]
---

- Use constructor injection in src/main, `@Autowired` only in tests
- Use `@Transactional` only when strictly necessary to wrap 2+ DB updates
- Global REST exception handling is done via `@RestControllerAdvice`
- Apply `@Validated` on every `@RequestBody`
- Write `equals`/`hashCode`/`toString` to a class only if it actually needs it
