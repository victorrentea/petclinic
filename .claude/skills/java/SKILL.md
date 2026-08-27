---
name: java
description: Java code style rules for this project's Spring Boot backend — constructor injection, @Transactional scope, MapStruct mapping, @RestControllerAdvice error handling, @Validated on request bodies, the allowed Lombok subset, and builder-chain formatting. Use whenever writing, editing or reviewing Java code under petclinic-backend/.
---

# Java Code Style

- Use constructor injection in src/main, `@Autowired` only in tests
- Use `@Transactional` only when strictly necessary: 2+ DB updates
- MapStruct is used for DTO mapping
- Global REST exception handling is done via `@RestControllerAdvice`
- Apply `@Validated` on each `@RequestBody`
- Use (only) Lombok's `@Slf4j`, `@RequiredArgsConstructor`, `@Builder`, `@Getter`/`@Setter`
- Builder chains: one property per line, unless only two properties are set
