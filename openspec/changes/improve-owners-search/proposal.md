## Why

The current owners search only supports prefix matching on `lastName`, making it hard to find owners by address, city, phone, or pet name. Replacing it with a full-text contains search across all visible columns significantly improves usability.

## What Changes

- **BREAKING** Rename API query param `?lastName=` → `?search=`
- Backend: replace prefix query with a JPQL `LIKE '%...%'` query across `firstName`, `lastName`, `address`, `city`, `telephone`, and pet `name` (via `LEFT JOIN`)
- Search string trimmed in controller before querying
- Frontend: remove "Find Owner" button; search triggers live on input with 300ms debounce
- UI copy: label `Last name` → `Search`; descriptive placeholder; updated no-results message

## Capabilities

### New Capabilities
- `owner-search`: Full-text, case-insensitive, live search across all owner and pet columns

### Modified Capabilities
<!-- none - no existing specs -->

## Impact

- `OwnerRepository`: new custom JPQL query method replacing `findByLastNameStartingWith`
- `OwnerRestController`: new `?search=` param, trim input, call new repository method
- `OwnerMapper` / DTOs: no change
- Frontend `owners-list` component: debounced input, remove search button, update labels
- API consumers: only the Angular frontend uses this endpoint; no backwards compatibility needed
