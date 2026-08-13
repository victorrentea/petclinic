---
name: java
description: Java/Spring code style rules for this project — dependency injection, @Transactional, MapStruct, REST exception handling, validation, allowed Lombok annotations, builder formatting. Read BEFORE writing or editing any Java file under petclinic-backend/, petclinic-database/, petclinic-chatbot/ or refactoring-legacy/, and when reviewing Java code for style.
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
