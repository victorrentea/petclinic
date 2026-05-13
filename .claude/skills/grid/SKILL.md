---
name: grid
description: Conventions for data grids — paginated, sortable, searchable list pages (owner-list, vet-list, ...). Load when building or editing a `*-list` component, adding pagination/sort/filter/search, writing search repository queries, or working with `Page<T>` / `PageRequest` / `Sort`.
---

# Grid (List/Table) Conventions

Paginated, sortable, searchable list pages — applies across backend + frontend.

## Backend (Repository + Controller)

- **EXISTS subquery, not `LEFT JOIN` + `DISTINCT`** — joining child rows multiplies the count; `DISTINCT` then breaks `LIMIT/OFFSET` pagination. Use `EXISTS (SELECT 1 FROM Pet p WHERE p.owner = o AND ...)`.
- **`ILIKE` + `pg_trgm` GIN index** — plain GIN index accelerates `ILIKE '%q%'` directly; no `LOWER(col)` expression index needed.
- **Sort by display order** — if the "Name" column shows "First Last", sort by `firstName, lastName` (matches what the user sees).
- **Reuse Spring's `Sort.Direction`** — don't invent an `ASC`/`DESC` enum.
- **Small filter/sort enums** belong inside the controller as inner enums (e.g. `enum SortField { NAME, CITY }`), not separate files.
- **`MethodArgumentTypeMismatchException` → 400** — register an `@ExceptionHandler` in `@RestControllerAdvice` so invalid enum query params don't return 500.
- **Flyway + Postgres extensions** — wrap `CREATE EXTENSION pg_trgm` (and dependent GIN indexes) in `DO $$ BEGIN ... EXCEPTION WHEN OTHERS THEN RAISE NOTICE ...; END; $$` so Zonky embedded Postgres (no pg_trgm) doesn't break tests.
- **Always paginate at DB level** — production has 100k+ owners; never `findAll()` into memory.

## Frontend (Angular Service + Component)

- **`switchMap` for search inputs** — cancels in-flight requests on new keystrokes.
- **`debounceTime(300)` for live search.**
- **Sort + pagination changes trigger a server re-fetch** — never sort/paginate client-side.
- **Enum params uppercase** — backend expects `ASC`/`DESC`, `NAME`/`CITY`.
- Standard layout: `src/app/<entity>/<entity>-list/`.

## Testing gotcha

- **Don't run partial `mvn test -Dtest=X` before committing** — overwrites `jacoco.csv` with partial coverage and blocks the coverage hook. Commit right after a full `mvn clean test`.
