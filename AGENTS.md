# Project Guidelines

> **Architecture reference:** Load `/memories/repo/Architecture.md` for key architectural decisions (e.g., OpenAPI contract direction: Java → YAML, not YAML → Java).

## Scope

Monorepo with two main applications:
- `petclinic-backend/`: Spring Boot 3.5 REST API (Java 21)
- `petclinic-frontend/`: Angular 16 SPA

This root file contains defaults for the whole workspace. Area-specific details live in:
- `petclinic-backend/AGENTS.md`
- `petclinic-frontend/AGENTS.md`

## Build And Test

Run full stack from repo root:

```sh
./start-all.sh
```

Useful root scripts:

```sh
./start-backend.sh
./start-frontend.sh
./start-tests.sh
```

Canonical detailed commands:
- Backend build/run/test: `petclinic-backend/AGENTS.md`
- Frontend build/run/test: `petclinic-frontend/AGENTS.md`
- QA Playwright flow: `qa/QUICKSTART.md`

## Architecture

High-level boundaries:
- Backend owns business logic, persistence, and search/filter semantics.
- Frontend consumes backend APIs; do not duplicate business filtering in UI unless explicitly required.
- QA project (`qa/`) provides end-to-end coverage using Playwright.

See:
- `README.md` for system overview and ER model.
- `petclinic-backend/readme.md` for API-first workflow and database profiles.

## Conventions

- Keep responses concise and challenge ambiguous or incorrect assumptions.
- Use constructor injection in production code; use `@Autowired` only in tests.
- Use `@Transactional` only when strictly necessary.
- Use MapStruct for DTO mapping and `@RestControllerAdvice` for global exception handling.
- Add `@Validated` on `@RequestBody` inputs.
- Prefer Lombok annotations already used in the codebase (`@RequiredArgsConstructor`, `@Slf4j`, etc.).
- Keep line length at or below 120 characters.
- Follow TDD strictly: write a failing test first, confirm failure, then implement.
- Do not ask for permission before running tests after refactoring.

Testing style notes for Java/TypeScript unit tests are documented in:
- `.github/instructions/testing.instructions.md`

## Search Rules

- Implement search behavior in backend by default.
- Keep matching logic in one layer (no duplicated filtering logic across layers).
- Default matching is case-insensitive unless explicitly requested otherwise.
- Use `LIKE` in JPQL queries, not `locate`.
- Implement search behavior in backend by default.
- Keep matching logic in one layer (no duplicated filtering logic across layers).
- Default matching is case-insensitive unless explicitly requested otherwise.
- Use `LIKE` in JPQL queries, not `locate`.
- Implement search behavior in backend by default.
- Keep matching logic in one layer (no duplicated filtering logic across layers).
- Default matching is case-insensitive unless explicitly requested otherwise.
- Use `LIKE` in JPQL queries, not `locate`.
- Implement search behavior in backend by default.
- Keep matching logic in one layer (no duplicated filtering logic across layers).
- Default matching is case-insensitive unless explicitly requested otherwise.
- Use `LIKE` in JPQL queries, not `locate`.
- Implement search behavior in backend by default.
- Keep matching logic in one layer (no duplicated filtering logic across layers).
- Default matching is case-insensitive unless explicitly requested otherwise.
- Use `LIKE` in JPQL queries, not `locate`.
- For large datasets, prefer server-side search and pagination.

## Task Modifiers

- "fast", "go", "Sparta": skip build/tests.
- "explain and commit": summarize changes as a training note.
- Auto-push after commit when git username is `victorrentea` and remote is `github.com/victorrentea/*`.
