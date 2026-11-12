# Proposal

## Why

Issue #25 requests Owners-grid pagination and sorting. With approximately 50,000 owners expected
within a year, downloading every matching owner is not viable; sorting must also match the full
names users actually see, including compound and accented names.

## What Changes

- Paginate and sort matching owners on the server, with page sizes 5, 10 and 20 (default 10).
- Sort Name by the displayed full name using English Unicode collation. Allow Address, City and
  Telephone sorting; explicitly exclude Pets, as agreed during the interview despite the issue's
  original "any column" wording.
- Preserve last-name-prefix search, existing owner links and Add Owner.
- Add accessible pagination, loading, empty and error states, and URL-backed grid state.
- Preserve the existing list API; add an explicit paginated contract that returns grid data only.
- Verify bounded data access and response shapes against an isolated 50,000-owner dataset.

The interview explicitly settled server-side processing, full-name ordering, English collation,
page sizes/default and the Pets exception. Remaining details use the recommended defaults from
the decision table at the user's request to fast-forward, and remain reviewable in this proposal.

Out of scope: other grids, pet sorting, changes to search semantics, production-data generation,
and unrelated backend or frontend cleanup.

## Capabilities

### New Capabilities

- `owner-grid`: Browsing, searching, sorting and navigating owners through a bounded, server-paged grid.

### Modified Capabilities

None. The project currently has no published capability specs.

## Impact

- Backend: Owner REST controller, repository queries, grid-specific DTO/mapping and focused tests.
  Keep the controller-to-repository architecture and existing authorization.
- Frontend: owner service, existing OwnerPage model, owner-list component/template/tests, and
  design-system combo integration for page size.
- Database: English collation for owner sort expressions; inspect query plans before adding indexes.
  No new database service or required extension is proposed.
- Contract/docs: regenerate OpenAPI and frontend types using existing tooling; document the grid
  behavior and API without hand-editing generated contracts.
- Tests: isolated embedded Postgres integration tests and existing Angular/Playwright tooling.
