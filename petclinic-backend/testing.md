# Testing Guidelines — Backend (Java / Spring Boot)

## General Style

- Use **AssertJ** for assertions (`assertThat`), never JUnit's built-in assertions.
- Test classes and methods use **package-protected** visibility (no `public`).
- Aim for **high functional density**: if complexity doesn't increase, cover more edge cases in one test  
  (e.g., test search with `'Ab'` matching `'xaBy'` — exercises LIKE + case-insensitivity in one shot).
- Use **constants** to document intent behind magic values (e.g., `OWNER_ID`, `BIRTH_DATE`).
- Keep tests **simple and explicit** — never reproduce logic from `src/main` in tests.
- **Chain setters** when constructing test data (Lombok `@Accessors(chain=true)` is enabled globally).
- Never mock getters of data structures — populate real/dummy instances instead.
- Use `@ParameterizedTest` when there are **≥ 3 data cases** (e.g., search criteria combinations).

## Integration Tests (Spring Boot)

- Use `@SpringBootTest` + `@AutoConfigureMockMvc` + `@Transactional` for HTTP-layer tests.
- Use `@WithMockUser(roles = "…")` or `SecurityMockMvcRequestPostProcessors.user(…)` for auth.
- Extract HTTP scaffolding (MockMvc helpers, ObjectMapper, page result DTOs) into a **base class**,  
  keeping test classes focused on business assertions only.
- Use `TestData` factory methods (`TestData.anOwner()`, `TestData.aPet()`) for consistent fixtures.
- Prefer `ownerRepository.save(…)` in `@BeforeEach` over SQL scripts for readable fixture setup.

## Cucumber / BDD Tests

- Feature files live in `src/test/resources/features/<domain>/`.
- Step definitions live in a `cucumber` sub-package of the tested domain.
- `@CucumberContextConfiguration` + `@SpringBootTest` + `@AutoConfigureMockMvc` go on a dedicated `CucumberSpringConfig` class.
- Glue code must be **minimal** — business intent belongs in the `.feature` file, not in steps.
- Track created entity IDs in steps and delete them in an `@After` hook for test isolation.
- Use `SecurityMockMvcRequestPostProcessors.user(…)` inside steps (not `@WithMockUser`).

## What NOT to Do

- Do not use Mockito to mock repositories or JPA entities in integration tests.
- Do not put `@Transactional` on Cucumber step classes — use `@After` cleanup instead.
- Do not duplicate filtering/search logic from `src/main` in test assertions.

