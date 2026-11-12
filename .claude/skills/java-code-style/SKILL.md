---
name: java-code-style
description: Apply the PetClinic Java code style when creating, changing, or reviewing Java code in this repository.
---

# Java code style

- Keep < 120 chars / line
- Keep methods under 30 lines
- Prefer stream FP pipelines over for
- Use constructor injection in src/main, `@Autowired` only in tests
- Use `@Transactional` only when strictly necessary to wrap 2+ DB updates
- Global REST exception handling is done via `@RestControllerAdvice`
- Apply `@Validated` on every `@RequestBody`
- Write `equals`/`hashCode`/`toString` to a class only if it actually needs it
