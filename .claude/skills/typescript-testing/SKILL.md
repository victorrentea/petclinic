---
name: typescript-testing
description: >
  Conventions for writing TypeScript unit and Playwright E2E tests in this project.
  Auto-trigger when: writing, editing, or reviewing any TypeScript test file (*.spec.ts,
  *.test.ts), generating Jest/Jasmine/Playwright test code, or when the user asks to
  "add a test", "write a test", "cover", or "TDD" in a TypeScript/Angular/Playwright context.
---

# TypeScript Testing Conventions

- **High functional density**: cover more edge cases per test without increasing complexity — e.g. search with `'Ab'` to match `'xaBy'` via case-insensitive matching in one test
- **Never mock getters** of data structures — populate real/dummy objects instead
- Build test data by **setting properties directly** on plain objects or instances
- Keep tests **simple and explicit** — do NOT replicate logic from source files
- Prefer **parameterised tests** (`test.each` / `it.each`) for ≥ 3 data cases (e.g. search-criteria combinations)
- Use **named constants** to explain magic values (e.g. `OWNER_ID`, `PET_NAME`)

