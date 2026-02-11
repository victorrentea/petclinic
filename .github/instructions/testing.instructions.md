---
description: Instructions for writing unit tests in Java or Typescript
---

## Unit Testing
- use JUnit 5 / Jasmine
- use package-protected visibility in test classes
- use AssertJ library instead of JUnit assertions
- tests should have a "high functional density": as long as the complexity of the test does not increase, try to cover more edge cases with a single test: eg. test a search with criteria='Ab' to match a value 'xaBy' in the DB with LIKE + UPPER operators.
- use Mockito for mocking dependencies in unit tests
- never mock getters of data structures, populate dummy instances instead
- separate the given/when/then sections of a @Test with empty lines, or add explicit "//when" if test is > 15 lines
- avoid obvious or redundant comments in tests
- test names must not start with 'test' and must be snake_case or camelCase
- test names should follow the pattern <then><when>, eg 'throwsForMissingName'
- never use reflection in tests
- keep tests simple and explicit, do NOT repeat any logic from src/main
- avoid repetitive tests: use @ParameterizedTests for ≥ 3 data cases, including search criteria combinations
- avoid trivial unit tests, only keep essential tests verifying core functionality
- use constants to explain test values such as ids of dummy data
- if available, use fluent setters when building test data
