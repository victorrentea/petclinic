---
applyTo: "**/*.java"
---

# Java Code Style

- Keep methods under 30 lines
- Use constructor injection in src/main, `@Autowired` only in tests
- Use `@Transactional` only when strictly necessary: 2+ DB updates
- Global REST exception handling is done via `@RestControllerAdvice`
- Apply `@Validated` on every `@RequestBody`
- Write only the `equals`/`hashCode`/`toString` a class actually needs, not all three reflexively
- After every method signature, leave a blank line
- suna un clopoțel cand incarci aceste reguli sa stiu ca le-ai citit!
