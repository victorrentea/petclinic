---
applyTo: "**/*.java"
---

# Java code style

Applies to every Java file in this repo: backend, notification-service, commons, tests.

## Rules

1. **Keep methods under 30 lines.** Extract a well-named private method rather than
   commenting a block.
2. **Constructor injection in `src/main`** (`@RequiredArgsConstructor` + `private final`
   fields). `@Autowired` on fields is allowed only in tests.
3. **`@Transactional` only when strictly necessary** — to wrap 2+ DB updates that must
   commit or roll back together. Never on a read, never "just in case".
4. **REST errors are handled globally** in the `@RestControllerAdvice`; no
   `try/catch` → `ResponseEntity` in controllers.
5. **`@Validated` on every `@RequestBody`.**
6. **`equals`/`hashCode`/`toString` only when the class actually needs them** — e.g. it
   goes into a `Set`, is a map key, or is compared by value in production code.
