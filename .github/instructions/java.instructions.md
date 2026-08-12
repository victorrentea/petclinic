---
applyTo: "**/*.java"
---

# Java code preferences

- Use constructor injection in `src/main`, `@Autowired` only in tests
- Use `@Transactional` only when strictly necessary
- MapStruct is used for DTO mapping
- Global exception handling in `@RestControllerAdvice`
- Apply `@Validated` on each `@RequestBody`
- Use (only) Lombok's `@Slf4j`, `@RequiredArgsConstructor`, `@Builder`, `@Getter`/`@Setter`
- Builder chains: one property per line, unless only two properties are set
