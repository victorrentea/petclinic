---
name: java
description: The Java code style of this project — constructor injection, no Lombok, no MapStruct, hand-written mappers and DTOs, @RestControllerAdvice, @Validated, when @Transactional is allowed, builder-chain formatting, line length. Load it whenever reading, writing or reviewing Java code here — before opening a .java file, before writing a new class, method, test or entity, and before commenting on someone else's Java.

---

# Java code style

- Keep line length ≤ 120 chars
- Use constructor injection in src/main, `@Autowired` only in tests
- Use `@Transactional` only when strictly necessary: 2+ DB updates
- DTO mapping is hand-written in `mapper/` — no MapStruct, no annotation processor
- Global REST exception handling is done via `@RestControllerAdvice`
- Apply `@Validated` on each `@RequestBody`
- No Lombok: write accessors, constructors and `LoggerFactory.getLogger(...)` explicitly
