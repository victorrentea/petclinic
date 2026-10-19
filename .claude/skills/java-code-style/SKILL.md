---
name: java-code-style
description: PetClinic's Java code style rules. Use whenever writing, editing, reviewing or refactoring Java code in this repo.
paths: ["**/*.java"] #MUST HAVE here = IT ALWAYS LOADS this before touch any .java file
---

# Java Code Style
- Keep < 120 chars / line
- Keep methods under 30 lines
- Use constructor injection in src/main, `@Autowired` only in tests
- Use `@Transactional` only when strictly necessary to wrap 2+ DB updates
- Global REST exception handling is done via `@RestControllerAdvice`
- Apply `@Validated` on every `@RequestBody`
- Write `equals`/`hashCode`/`toString` to a class only if it actually needs it
