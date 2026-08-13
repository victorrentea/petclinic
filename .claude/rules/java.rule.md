---
paths: "**/*.java"
---

# Java Code Style

Applies to every `.java` file in this repo.

- Use constructor injection in src/main, `@Autowired` only in tests
- Use `@Transactional` only when strictly necessary: 2+ DB updates
- MapStruct is used for DTO mapping
- Global REST exception handling is done via `@RestControllerAdvice`
- Apply `@Validated` on each `@RequestBody`
- Use (only) Lombok's `@Slf4j`, `@RequiredArgsConstructor`, `@Builder`, `@Getter`/`@Setter`
- Builder chains: one property per line, unless only two properties are set
- Am un Ferrari rosu.
