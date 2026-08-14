## Context

See `proposal.md` — Why, and `QA.md` for the full decision record. Requirements are in
`specs/owner-listing/spec.md`; this document only explains how they are met.

Constraints that shape the approach:

- **Spring Boot 3.5 / Java 21 / Angular 16.** Angular Material 16.2.1 is present and *partly* wired:
  the `indigo-pink` prebuilt theme is imported in `styles.css`, and `BrowserAnimationsModule` +
  `MatSnackBarModule` are in `app.module.ts`. No grid components are used anywhere.
- **`OwnerRepository extends Repository<Owner, Integer>`** — the deliberately minimal Spring Data
  interface, exposing only the handful of methods the project chose to publish.
- **`Owner.pets` is `@OneToMany(fetch = LAZY)` (a `Set`)**, and `OwnerDto` → `PetDto` →
  `List<VisitDto>`, so the list response is three levels deep with an N+1 per level.
- **The database collates as `C`** (Postgres 16.2, UTF-8). ICU collations are available — 785 of
  them, including `ro-x-icu`.
- **`openapi.yaml` is generated** from the backend and drives `src/app/generated/api-types.ts`.
  CI runs Spectral lint plus a SonarCloud Quality Gate that fails the build.
- **`petclinic-test/src/owner-search.glue.ts` selects on `#ownersTable` and `td.ownerFullName`**,
  and carries a comment documenting a pre-existing out-of-order-response bug.

## Goals / Non-Goals

**Goals:**
- Bounded payload and bounded query cost at 10,000 owners.
- Sort correctness that does not depend on which database instance answers.
- One code path serving all three sorts, so adding a fourth is trivial.
- A backend paging shape the other four controllers can adopt verbatim later.
- Preserve existing E2E selectors so behavioural regressions are not buried in a test rewrite.

**Non-Goals:**
- Cursor/keyset pagination (see the last requirement in the spec — deliberately excluded).
- Migrating the other four grids.
- Optimising the list payload beyond fixing the N+1 (trimming `visits` is a follow-up).
- Natural/numeric-aware address sorting — Address is not sortable.

## Decisions

### D1 — Break `GET /api/owners` in place rather than adding a paged endpoint

All consumers are internal: one Angular screen and our own tests. The chatbot and MCP server use
`/api/owners/{id}`. A parallel `/api/owners/paged` would mean two code paths, two OpenAPI entries
and a deprecated endpoint nobody deletes.

*Alternatives:* a second endpoint (rejected: permanent dead code); paging only when `page` is
supplied (rejected: response type varying by query parameter is modelled badly by OpenAPI and
handled worse by clients).

### D2 — An explicit page-response DTO, not Spring's `Page`

Spring's `Page` serialises with a deprecation warning in recent Boot versions and its JSON shape is
explicitly not stable API. A small DTO carrying `content`, `totalElements`, `number` and `size`
makes OpenAPI describe something real and decouples the wire format from Spring internals.

Consequence: the hand-written `petclinic-frontend/src/app/owners/owner-page.ts` is **deleted** — a
hand-maintained mirror of a generated contract is exactly how the two drift apart.

### D3 — `petCount` as a derived entity property

`petCount` is not a column; it is a `COUNT` over a join. Declaring it as a Hibernate `@Formula`
correlated subquery makes `Sort.by("petCount")` work through the ordinary derived-query mechanism,
so **a single repository method serves all three sorts**. It also supplies the count the grid must
display, with no extra plumbing.

*Alternatives:* a dedicated `@Query` with `LEFT JOIN … GROUP BY` (rejected for now: forces two code
paths, one per sort family); a denormalised `pet_count` column kept by trigger (rejected: schema and
consistency burden for a problem we have not measured).

*Caveat:* sorting by a correlated subquery evaluates it per row. At 10,000 rows expect milliseconds.
Measure before escalating to either alternative.

### D4 — `@BatchSize` for the pets, never a fetch join

A fetch join combined with `Pageable` makes Hibernate load the **entire** result set and paginate
**in memory** (`HHH000104`) — precisely the failure this change exists to prevent, and one that
passes every test at 28 rows. `@BatchSize` on `Owner.pets` collapses the per-row lookups into one
batched query for the page. The same treatment applies one level down for `Pet.visits`.

A guardrail test asserting the query count for a page load is the only thing that stops a future
"optimisation" reintroducing the fetch join.

### D5 — Pin the collation on the columns, not on the database

```sql
ALTER TABLE owners ALTER COLUMN last_name  TYPE text COLLATE "ro-x-icu";
ALTER TABLE owners ALTER COLUMN first_name TYPE text COLLATE "ro-x-icu";
ALTER TABLE owners ALTER COLUMN city       TYPE text COLLATE "ro-x-icu";
```

Column-level collation requires **no Java changes at all** — every `ORDER BY` inherits it, and
`Sort.by("lastName")` keeps working untouched. Crucially it makes ordering a property of the
*schema*, so dev, CI and production cannot disagree; relying on the database default produces a bug
class that passes CI and fails in production.

*Alternatives:* `lower(unaccent(...))` in hand-written queries (rejected: abandons Spring Data
`Sort` and complicates every future sortable column); changing the database default (rejected: not
expressible as a Flyway migration against an existing database, and does not travel with the schema).

### D6 — Validate the sort in the controller, against an explicit allowlist

The sort parameter is a property name that reaches the persistence layer. A small mapping from the
three **public** names to entity properties is applied before any `Sort` is constructed; anything
else is rejected with 400. The tiebreaker is appended in the same place, so the whole ordering rule
lives in one readable method.

**Explicitly rejected:** accepting Spring's `Pageable` argument resolver as-is. It happily builds a
`Sort` from whatever the client sends, which is how an unvalidated property name reaches the query.

### D7 — Public sort names decoupled from entity fields

`sort=name,asc` / `city` / `petCount`. `name` means last-name-then-first-name, which no single
entity property expresses; leaking `lastName` into the URL would misdescribe the behaviour and pin
us to the current mapping. These names are a shareable-link contract (see the spec's
addressable-view-state requirement) and cannot be renamed casually afterwards.

### D8 — Keep the Bootstrap table; add `matSort` headers and `mat-paginator`

`matSort` / `mat-sort-header` attach to plain `<th>` elements, and `<mat-paginator>` is a standalone
component. The Material theme and animations are already imported, so this is an import and a
template addition — no restyle, no template rewrite, and `#ownersTable` / `td.ownerFullName` survive.

*Alternative:* a full `mat-table` rewrite. Cleaner Material idiom and better a11y out of the box, but
it restyles one screen in an app that is Bootstrap 3 everywhere else and breaks every E2E selector.
Revisit only if all five grids migrate together.

### D9 — `switchMap` for request ordering

The grid's requests become a stream keyed on the view state; `switchMap` cancels the previous
subscription so only the newest response can paint. This fixes the pre-existing search race that
`OwnersPage.ts` documents in a comment, rather than working around it with waits.

*Alternative:* disabling the pager while a request is in flight — simpler, but makes fast paging feel
sticky and does nothing for the search race.

### D10 — URL as the single source of view state

The component reads page/size/sort/search from the query parameters and reacts to them; user actions
navigate rather than mutate local state. Back, reload and shared links then work by construction
instead of by synchronisation. Sort/page/size changes **replace** the history entry rather than
pushing one, so Back leaves the grid instead of stepping through every sort click.

## Risks / Trade-offs

- **A fetch join is reintroduced later and paging silently moves in-memory** → D4's query-count
  guardrail test; `HHH000104` is a warning, not a failure, so only a test catches it.
- **`@Formula` sorting is slower than expected at 10,000 rows** → measure during implementation;
  D3 records both escalation paths. Not blocking, since the fallbacks are local to the repository.
- **The collation migration rebuilds indexes on `owners`** → trivial at 10,000 rows; would need a
  maintenance window at a far larger scale.
- **Prefix search loses its index under a non-`C` collation** → `LIKE 'Dav%'` needs a
  `text_pattern_ops` index to stay index-backed. Imperceptible at 10,000 rows; noted, not acted on.
- **The URL parameter names become a public contract** → chosen deliberately in D7; renaming later
  breaks colleagues' bookmarks.
- **Breaking the response shape breaks seven test files at once** → all seven are enumerated in
  `proposal.md` → Impact; none are unknown, and repairing them is explicit work in `tasks.md`.
- **The perf test's throughput baseline shifts** (10 rows instead of 28) →
  `OwnerSearchThroughLatencyProxyTest` is already flaky locally and green in CI. Do not chase the
  new baseline as part of this change.
- **Sonar's new-code coverage gate fails the build** → tests are written first, per `CLAUDE.md`.

## Migration Plan

1. Flyway migration for the collation ships with the backend; it is forward-only and idempotent in
   effect (re-running the `ALTER` is harmless).
2. Backend and frontend must deploy **together** — D1 is a breaking response change, and the repo
   ships both from one build.
3. **Rollback:** revert the deployment. The collation migration can stay in place; it changes only
   ordering, and the previous code tolerates any collation.

## Open Questions

- Whether `visits` should leave the list payload entirely (a slim list DTO). Deferred to a follow-up
  issue by decision; it changes no requirement in this change's spec and no task here.
