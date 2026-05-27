---
name: java
description: Apply Java/Spring Boot code preferences for the PetClinic backend. Load ONLY when reading or writing files matching **/*.java. Do NOT load for Kotlin, Groovy, XML, properties, YAML, SQL, or any non-.java file — even inside petclinic-backend/.
---

# Java Code Preferences

Scope: this skill applies **only** to `**/*.java` files. Skip it for all other file types.

- Constructor injection for production, `@Autowired` only in tests
- `@Transactional` only when strictly necessary
- MapStruct for DTO mapping
- Global exception handling in `@RestControllerAdvice`
- `@Validated` on `@RequestBody`
- Use Lombok: `@Slf4j`, `@RequiredArgsConstructor`, `@Builder`, `@Getter`/`@Setter` selectively
- Keep line length ≤ 120 chars
- Never ask before running tests after refactoring
- Builder chains: one property per line, unless only 2 properties total
