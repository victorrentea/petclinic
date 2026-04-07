## Why

Owner list page becomes slow and hard to navigate as data grows. Pagination improves performance and usability.

## What Changes

- Add server-side pagination to Owners API (page, size, sort)
- Update frontend owner grid to request paged data
- Add pagination controls (page, size selector, next/prev)
- Preserve filters/search across pages
- Page size selectable by user (10, 20, 50)
- Display total pages in UI

## Capabilities

### New Capabilities
- `owner-pagination`: Paginated retrieval and navigation of owners in UI and API

### Modified Capabilities
- `owners-management`: Owners listing now supports pagination parameters and responses

## Impact

- Backend: Owners REST endpoint, service, repository
- Frontend: owners list component, service
- API contract: paginated response (content, totalElements, totalPages)
