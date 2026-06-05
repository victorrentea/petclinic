---
name: code-style
description: Owner's code style preferences for PetClinic. Load BEFORE writing or refactoring production code (backend or frontend). NOT needed for debugging, reading, analysis, or running tests.
---

# Code Style

- Constructor injection for production code
- Hand-written stateless mapper functions for DTO mapping (no codegen, no DI)
- `class-validator` decorators on request DTOs for validation
- Global exception handling via a single Nest exception filter (RFC-7807 ProblemDetail)
- Keep line length ≤ 120 chars
- Builder/object chains: one property per line, unless only 2 properties total
- Avoid ternary unless it fits in half a line (~60 chars); use if/else otherwise
