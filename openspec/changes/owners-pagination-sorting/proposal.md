## Why

The list of pet owners is expected to grow to around 10,000 within a year. Today the Owners screen loads every owner at once, which will become slow and unwieldy well before we reach that size. We need to show owners a page at a time and let staff sort the list, so the screen stays fast and usable as the clinic's owner base grows.

## What Changes

- The Owners screen shows owners a page at a time instead of all at once.
- Staff can choose how many owners to see per page: 5, 10, or 20.
- Staff can sort the list by **Name** or **City** by clicking the column heading.
- By default, the list is sorted by last name, then first name, both ascending.
- The **Name** column now displays "Last name, First name" (previously "First name, Last name"), to match the new default sort order.
- The existing "search by last name" box keeps working, combined with the chosen sort order and page.
- **Note (impacts other teams/tools):** anything outside the Owners screen that reads the owners list from our system will need to be updated to work with the new paged format — see design.md for details.

## Capabilities

### New Capabilities
- `owners-listing`: Paginated, sortable, last-name-filterable retrieval of owners, including validation rules for sort/page-size and the frontend grid behavior (columns, default sort, pagination controls, Name column display order).

### Modified Capabilities
(none — this is the first spec capturing owner-listing behavior in `openspec/specs/`)

## Impact

- **Owners screen**: new pagination controls, clickable sort on Name/City, reordered Name display.
- **Anyone/anything else reading the owners list from our system**: must adapt to the new paged format (see design.md - this is a breaking change for external consumers).
- **Testing**: new test coverage for pagination, sorting, and validation behavior on both the screen and the underlying service.
