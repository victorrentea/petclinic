# Owner Unified Search Plan

## Objective
Implement one owner search field that provides predictable, language-tolerant matching and low backend load.

## Scope
- One search input in Owners screen.
- Search with OR across owner fields only:
  - `firstName`
  - `lastName`
  - `address`
  - `city`
  - `telephone`
- Exclude pet fields (no `pet.name` search).
- Input empty => show all owners.

## Functional Requirements
- Case-insensitive matching.
- Digit matching supported.
- Diacritic-insensitive matching for Latin scripts (Romanian, French, Turkish, etc.).
- Substring matching (`%term%` semantics).
- No search button.
- Trigger search:
  - on blur (immediate), or
  - after 700 ms pause in typing.
- Deduplicate requests so blur + debounce does not send duplicates for the same normalized term.

## Normalization Strategy
Apply the same logical normalization to both query term and searchable values.

Steps:
1. Trim and collapse whitespace.
2. Lowercase using `Locale.ROOT`.
3. Unicode normalize with NFKD.
4. Remove combining marks (`\p{M}`).
5. Apply explicit transliterations for known Latin edge cases:
   - `ß -> ss`
   - `œ -> oe`, `æ -> ae`
   - `ø -> o`, `ł -> l`, `đ -> d`, `ı -> i`, `ç -> c`
6. Keep letters and digits.

### Expected Equivalence Examples
- Searching `șanț` matches `șanț`, `șant`, `sant`, `sanț`.
- Searching `șant` matches `șanț`, `șant`, `sant`, `sanț`.
- Searching `francois` matches `françois`.
- Searching `igdir` matches `ığdır`.

## Technical Approach

### Backend (Spring Boot)
- Keep current endpoint contract if possible (no OpenAPI change unless explicitly approved).
- Implement owner-only OR search logic on normalized values.
- Ensure `%term%` semantics and stable ordering.
- Maintain current DTO response shape.

### Frontend (Angular)
- Keep one input field.
- Build event stream:
  - typing stream with `debounceTime(700)` + `distinctUntilChanged` on normalized term,
  - blur stream with immediate trigger.
- Merge streams and deduplicate by last emitted normalized term.
- Use `switchMap` to cancel in-flight stale requests.
- Remove manual submit button behavior.

## Acceptance Criteria
- One visible search field on Owners screen.
- No search button required.
- Search works on owner fields only (no pet-name influence).
- Case-insensitive + diacritic-insensitive behavior validated.
- Substring matching works for middle-of-word queries.
- Digits are searchable.
- Input empty reloads all owners.
- No duplicate request for same normalized term when blur and debounce overlap.

## Test Plan

### Backend Integration Tests
- OR matching across each owner field.
- Negative check: pet name match does not return owner.
- Case-insensitive search.
- Latin diacritic-insensitive search (RO/FR/TR examples).
- Substring (`%term%`) behavior.
- Numeric term behavior.

### Frontend Unit Tests
- Debounce fires after 700 ms.
- Blur fires immediate search.
- Blur after typing does not duplicate request for same normalized term.
- Empty input fetches full owner list.

### Optional E2E Smoke
- Real UI flow with diacritics and numeric terms.

## Risks and Mitigations
- `%term%` may be expensive on large datasets.
  - Mitigation: introduce normalized searchable column/index strategy if needed.
- FE/BE normalization drift.
  - Mitigation: shared canonical test cases and fixtures.
- DB differences (H2 vs PostgreSQL).
  - Mitigation: run targeted tests on both profiles before release.

## Rollout
1. Backend search update + tests.
2. Frontend trigger/dedup update + tests.
3. End-to-end validation with agreed examples.
4. Release and monitor request volume + response time.

## Open Questions (For Review)
- Minimum character threshold before search (`1` vs `2`) to protect performance?
- Keep existing query param name vs add dedicated `q`?
- Do we need paging/sorting stabilization in the same change?

## Contract Guardrail
Any change to `openapi.yaml` requires explicit human confirmation before update.
