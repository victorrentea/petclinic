## Why

The Owners directory currently returns and renders one unsorted list, which does not scale for larger datasets and makes it harder for staff to browse owners predictably. This change adds the basic grid behaviors the business expects so owners can be found, ordered, and browsed efficiently.

## What Changes

- Add pageable browsing to the Owners grid with page sizes of 5, 10, and 20 rows.
- Add column sorting for Name and City in the Owners grid.
- Change the Name column presentation to show `Last name First name`.
- Keep the existing last-name search and make pagination and sorting operate on the filtered result set.
- Preserve grid state in the URL so the current filter, page, page size, and sort survive refresh and navigation.
- Normalize invalid grid query parameters to safe defaults.

## Capabilities

### New Capabilities
- `owner-directory-browsing`: Browse the Owners directory with server-side filtering, sorting, pagination, and shareable grid state.

### Modified Capabilities

## Impact

- Affects the Owners grid behavior in the frontend.
- Affects the Owners listing API contract in the backend.
- Adds OpenSpec capability coverage for owner-directory browsing behavior.
