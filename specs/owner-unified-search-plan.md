# Owner Unified Search Plan

## Objective
Implement one owner search field that provides predictable, language-tolerant matching and low backend load.

## API Contract Decision
- The target API contract for unified owner search is `GET /api/owners?q={searchText}`.
- Use `q` instead of `lastName` because the new search covers more than surname-only matching.
- If rollout safety requires it, backend may temporarily accept `lastName` as a compatibility alias, but `q` is the documented target contract.

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
- Digit matching  eg: "2" should return "1311231255".
- Diacritic-insensitive matching for Latin scripts (Romanian, French, Turkish, etc.).
- Substring matching (`%term%` semantics).
- Minimum search length for filtered search: 2 characters.
- Maximum search length: 256 characters.
- No search button.
- Trigger search:
  - on Enter (immediate), or
  - on blur (immediate), or
  - after 700 ms pause in typing.
- Deduplicate requests so Enter + blur + debounce do not send duplicates for the same normalized term.

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
- Target contract: `GET /api/owners?q={searchText}`.
- If temporary compatibility is needed during rollout, backend may also accept `lastName`, but `q` remains the documented contract.
- Updating `openapi.yaml` for `q` requires explicit human confirmation before the contract file is changed.
- Implement owner-only OR search logic on normalized values.
- Ensure `%term%` semantics and stable ordering.
- Maintain current DTO response shape.

### Frontend (Angular)
- Keep one input field.
- Send the user's search text as query parameter `q`.
- Build event stream:
  - Enter key stream with immediate trigger,
  - typing stream with `debounceTime(700)` + `distinctUntilChanged` on normalized term,
  - blur stream with immediate trigger.
- Merge streams and deduplicate by last emitted normalized term.
- Enter-triggered search must bypass debounce delay.
- Enter-triggered search must cancel or supersede any pending debounce for the same normalized term.
- Use `switchMap` to cancel in-flight stale requests.
- Remove manual submit button behavior.

## Acceptance Criteria
- One visible search field on Owners screen.
- No search button.
- Pressing Enter triggers immediate search.
- Search terms shorter than 2 characters do not trigger filtered search.
- Search terms longer than 256 characters are rejected consistently by frontend and backend validation.
- Search works on owner fields only (no pet-name influence).
- Case-insensitive + diacritic-insensitive behavior validated.
- Substring matching works for middle-of-word queries.
- Digits are searchable.
- Input empty reloads all owners.
- No duplicate request for same normalized term when Enter, blur, and debounce overlap.

## Test Plan

### Backend Integration Tests
- OR matching across each owner field.
- Negative check: pet name match does not return owner.
- Case-insensitive search.
- Latin diacritic-insensitive search (RO/FR/TR examples).
- Substring (`%term%`) behavior.
- Numeric term behavior.
- Validation for search term length > 256.

### Frontend Unit Tests
- Debounce fires after 700 ms.
- Enter fires immediate search.
- Blur fires immediate search.
- Enter after typing does not wait for debounce.
- Enter followed by blur does not duplicate request for same normalized term.
- Blur after typing does not duplicate request for same normalized term.
- Empty input fetches full owner list.
- Input shorter than 2 characters does not trigger filtered search.
- Input longer than 256 characters is blocked or rejected consistently.

### MUST E2E Smoke
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
- Q: Minimum character threshold before search (`1` vs `2`) to protect performance? A: minimum 2 chars 
- Q: Maximum search length? A: 256 chars.
- Do we need paging/sorting stabilization in the same change?

## Contract Guardrail
Any change to `openapi.yaml` requires explicit human confirmation before update.
