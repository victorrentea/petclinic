## Why

The list of pet owners is expected to grow to around 10,000 within a year. Today the Owners screen loads every owner at once, which will become slow and unwieldy well before we reach that size. We need to show owners a page at a time and let staff sort the list, so the screen stays fast and usable as the clinic's owner base grows.

## What Changes

- The Owners screen shows owners a page at a time instead of all at once.
- Staff can choose how many owners to see per page: 5, 10, or 20.
- Staff can sort the list by **Name** or **City** by clicking the column heading.
- By default, the list is sorted by last name, then first name, both ascending.
- The **Name** column now displays the last name first, then the first name (e.g. "Smith John" instead of "John Smith"), to match the new default sort order.
- Clicking a column heading that is already being sorted flips the order between A→Z and Z→A.
- The existing "search by last name" box keeps working, combined with the chosen sort order; starting a new search returns the user to the first page of results.
- **Note (impacts other teams/tools):** anything outside the Owners screen that reads the owners list from our system will need to be updated to work with the new paged format — see design.md for details.

## Assumptions to confirm

These were decided during planning without explicit sign-off — please confirm or correct them during review:

- **Default order**: when the user hasn't chosen a sort, the list is ordered by last name (A→Z), then first name (A→Z).
- **Only Name and City can be sorted**: asking for any other ordering is refused rather than silently ignored.
- **Only 5, 10 or 20 owners per page** may be requested; any other amount is refused.
- **One screen, one list**: the "search by last name" box stays on the same Owners list rather than becoming a separate search screen.
- **Starting a new search returns to the first page** of results.

## Capabilities

### New Capabilities
- `owners-listing`: Paginated, sortable, last-name-filterable retrieval of owners, including validation rules for sort/page-size and the frontend grid behavior (columns, default sort, pagination controls, Name column display order).

### Modified Capabilities
(none — this is the first spec capturing owner-listing behavior in `openspec/specs/`)

## Impact

- **Owners screen**: new pagination controls, clickable sort on Name/City, reordered Name display.
- **Anyone/anything else reading the owners list from our system**: must adapt to the new paged format (see design.md - this is a breaking change for external consumers).
- **Testing**: new test coverage for pagination, sorting, and validation behavior on both the screen and the underlying service.
