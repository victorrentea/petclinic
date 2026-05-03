## Why

The owner search screen currently loads every matching owner in a single response and renders a static table with no ordering controls. With production-scale datasets of roughly 10,000 owners, the screen becomes slower to scan and harder to use because users cannot move through results page by page, sort the most relevant columns, or share the exact search state they are viewing.

## What Changes

- Add paginated owner listing so the owner search screen can request and display a specific numbered page of results.
- Let users choose between 10 and 20 rows per page on the owner search screen.
- Add sortable owner listing so users can reorder the owner search screen by Name and City.
- Preserve the existing owner search flow while applying pagination and sorting to both filtered and unfiltered results.
- Keep owner search state in the URL so query, sort, page, and rows per page survive refresh, back/forward navigation, and sharable links.
- Update the owner listing API contract and frontend data flow to exchange page metadata, selected sort, selected page, and selected page size using server-driven pagination and sorting.
- Add automated coverage for backend owner listing behavior and frontend owner search screen interactions around pagination, sorting, and URL state.

## Capabilities

### New Capabilities
- `owner-search-screen`: Browse owners on the search screen through paginated, sortable results while keeping search results navigable.

### Modified Capabilities

## Impact

- Affected backend code in the owner listing controller, repository queries, DTO/response contract, and API tests.
- Affected frontend code in the owner list component, owner service, owner page model, and owner list component tests.
- Affected API documentation in `openapi.yaml` for the `/api/owners` query parameters and paginated response schema.
