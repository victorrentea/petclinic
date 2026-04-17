# GitHub Copilot Instructions

## Writing Unit Tests (Java or TypeScript)

- Use AssertJ library instead of JUnit assertions
- Use package-protected visibility in test classes
- Tests should have a "high functional density": as long as the complexity of the test does not increase, try to cover more edge cases with a single test: e.g. test a search with criteria='Ab' to match a value 'xaBy' in the DB with LIKE + UPPER operators.
- Never mock getters of data structures, populate dummy instances instead
- Chain setters if possible when constructing test data
- Keep tests simple and explicit, do NOT repeat any logic from src/main
- Prefer @ParameterizedTests for ≥ 3 data cases, e.g.: search criteria combinations
- Use constants to explain test values such as CUSTOMER_ID

