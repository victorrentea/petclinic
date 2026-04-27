---
name: java-testing
description: >
  Conventions for writing Java unit and integration tests in this project.
  Auto-trigger when: writing, editing, or reviewing any Java test class or
  test method, generating JUnit/Mockito/Spring test code, or when the user
  asks to "add a test", "write a test", "cover", or "TDD" in a Java context.
---

# Java Testing Conventions

- Use **AssertJ** assertions (`assertThat(...)`) — never JUnit's `assertEquals` / `assertTrue`
- Use **package-protected** visibility for test classes (no `public` modifier)
- **High functional density**: cover more edge cases per test without increasing complexity — e.g. use criteria `'Ab'` to match `'xaBy'` in the DB via `LIKE + UPPER` in one test
- **Never mock getters** of data structures — populate real/dummy instances instead
- **Chain setters** when constructing test data
- Keep tests **simple and explicit** — do NOT replicate logic from `src/main`
- Prefer `@ParameterizedTest` for ≥ 3 data cases (e.g. search
- **Chain setters** when constructing test data
- Keep tests **simple and explicit** — do NOT replicate logic from `src/main`
- Prefer `@ParameterizedTest` for ≥ 3 data cases (e.g. search-criteria combinations)
- Use **named constants** to explain magic values (e.g. `OWNER_ID`, `PET_NAME`)

