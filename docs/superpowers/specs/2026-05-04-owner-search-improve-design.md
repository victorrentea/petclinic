# Owner Search — Improvements

## Goal

Replace the manual "Find Owner" button with a live, debounced, case-insensitive search across multiple owner fields, with race-condition protection between concurrent backend calls.

## Current State

- Frontend (`owner-list.component.ts`): single text input bound via `[(ngModel)]`; search triggered only by clicking **Find Owner**. No debounce, no in-flight cancellation.
- Backend (`OwnerRestController#listOwners`): accepts `?lastName=`, calls `OwnerRepository.findByLastNameStartingWith(lastName)` — **last-name only**, **starts-with**, **case-sensitive** (JPA derived query default).

## Requirements

1. Search fires automatically as the user types, debounced (~300 ms).
2. Search matches **substrings** (contains, not starts-with) across: `firstName`, `lastName`, `city`, `address`, `telephone`.
3. Case-insensitive.
4. Race-safe: only the latest request's result is rendered (cancel/ignore stale responses).
5. Empty input → list all owners (current behavior preserved).

## Non-Requirements

- Full-text search / tsvector indexing (out of scope; flagged below).
- Pagination changes (existing behavior preserved).
- Searching pet names (excluded per user choice "B").

## Backend Design

### Endpoint

`GET /api/owners?q={text}` — replaces `?lastName=`.

- `q` absent → `findAll()` (unchanged behavior).
- `q` present → `OwnerRepository.search(q)`.

### Repository

Add to `OwnerRepository`:

```java
@Query("""
    SELECT o FROM Owner o
    WHERE LOWER(o.firstName) LIKE LOWER(CONCAT('%', :q, '%'))
       OR LOWER(o.lastName)  LIKE LOWER(CONCAT('%', :q, '%'))
       OR LOWER(o.city)      LIKE LOWER(CONCAT('%', :q, '%'))
       OR LOWER(o.address)   LIKE LOWER(CONCAT('%', :q, '%'))
       OR LOWER(o.telephone) LIKE LOWER(CONCAT('%', :q, '%'))
    """)
List<Owner> search(@Param("q") String q);
```

Remove `findByLastNameStartingWith` (no longer used).

### Controller

```java
public List<OwnerDto> listOwners(@RequestParam(name = "q", required = false) String q) {
    List<Owner> owners = (q != null) ? ownerRepository.search(q) : ownerRepository.findAll();
    return ownerMapper.toOwnerDtoCollection(owners);
}
```

### OpenAPI

Update `openapi.yml` for `listOwners`: replace `lastName` query param with `q`. Re-run `mvn clean install` to regenerate DTOs.

## Frontend Design

### Service

`OwnerService.searchOwners(q: string)` → `GET /api/owners?q={q}` (rename param from `lastName` to `q`).

### Component

Replace `[(ngModel)]` with reactive `FormControl`. In `ngOnInit`:

```ts
this.searchControl.valueChanges.pipe(
  startWith(''),
  debounceTime(300),
  distinctUntilChanged(),
  switchMap(q => q ? this.ownerService.searchOwners(q) : this.ownerService.getOwners())
).subscribe(owners => this.owners = owners, err => this.errorMessage = err);
```

`switchMap` cancels the previous HTTP request when a new keystroke arrives → race-safe by construction.

Remove the **Find Owner** button and the `searchByLastName(...)` method.

### Template

- Replace `[(ngModel)]="lastName"` with `[formControl]="searchControl"`.
- Update label "Last name" → "Search".
- Remove the submit button.
- Update the empty-state message to use the search term, not just `lastName`.

## Testing (TDD)

### Backend
1. `OwnerRestControllerTests`: `?q=fra` returns owners whose first/last/city/address/telephone contains "fra" (case-insensitive). Add a fixture row that matches via `city` only to prove multi-field coverage.
2. `?q=` absent → returns all owners.
3. Old `?lastName=` no longer treated specially (any `lastName=...` query is ignored / 200 with full list).

### Frontend
1. Typing "l" debounced → service called once with `"l"` after 300 ms (use `fakeAsync`/`tick`).
2. Two rapid keystrokes → only one outstanding request; the earlier one's emission is dropped (race test).
3. Empty input → `getOwners()` is called.

## Tradeoffs / Follow-ups

- `LIKE '%q%'` on 5 columns ignores B-tree indexes; will not scale to 100k owners. **Out of scope here.** Follow-up: introduce Postgres `tsvector` + GIN index (or H2 `FT_SEARCH` for the dev profile) and switch the `search` query.
- Empty-input branch still loads `findAll()` — pre-existing scaling issue, not addressed in this change.
