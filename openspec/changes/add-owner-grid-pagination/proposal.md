## Why

The Owners grid currently loads every owner into the browser and offers neither
sorting nor pagination. That is no longer acceptable for production-scale data,
where the Owners table can reach roughly 1M rows and must remain usable at
that scale.

## What Changes

- Add pagination to the Owners grid with page sizes of 5, 10, and 20 rows.
- Add sorting for the grid columns Name, Address, City, and Telephone.
- Change the grid name display to show last name first, then first name.
- Keep the existing last-name filter and combine it with paging and sorting.
- Coordinate the owners-listing behavior across the application so the updated
  browsing experience works consistently wherever owner lists are consumed.

## Capabilities

### New Capabilities
- `owners-grid-browsing`: Browse owners through a paged, sortable grid that
  remains usable for production-scale owner lists.

### Modified Capabilities
- None.

## Impact

- Owners browsing and searching in the web UI.
- Users who need to scan large owner lists efficiently.
- Application flows that consume owner-listing behavior.
