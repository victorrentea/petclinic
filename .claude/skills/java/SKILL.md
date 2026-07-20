---
name: java
description: The PetClinic owner's Java code preferences (Spring Boot / MapStruct / Lombok conventions). Load whenever writing, editing, or reviewing Java files in this repo.
---

# Java code preferences

Apply these when writing, editing, or reviewing Java in this repo.

- Constructor injection for production, `@Autowired` only in tests
- `@Transactional` only when strictly necessary
- MapStruct for DTO mapping
- Global exception handling in `@RestControllerAdvice`
- `@Validated` on `@RequestBody`
- Use only Lombok's `@Slf4j`, `@RequiredArgsConstructor`, `@Builder`, `@Getter`/`@Setter` selectively
- Never ask before running tests after refactoring
- Builder chains: one property per line, unless only 2 properties total
