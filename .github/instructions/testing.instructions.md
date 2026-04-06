---
description: Instructions for writing unit tests in Java or Typescript
---

- use AssertJ library instead of JUnit assertions
- use package-protected visibility in test classes
- tests should have a "high functional density": as long as the complexity of the test does not increase, try to cover more edge cases with a single test: eg. test a search with criteria='Ab' to match a value 'xaBy' in the DB with LIKE + UPPER operators.
- never mock getters of data structures, populate dummy instances instead
- chain setters if possible when constructing test data
- keep tests simple and explicit, do NOT repeat any logic from src/main
- prefer @ParameterizedTests for ≥ 3 data cases, eg: search criteria combinations
- use constants to explain test values such as CUSTOMER_ID
