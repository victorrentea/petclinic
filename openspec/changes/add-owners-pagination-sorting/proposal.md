## Why

The Owners screen tries to load and display every owner at once. The owners list is expected to grow to roughly **one million people**, and at that size loading everything is too slow to be usable and will eventually stop working altogether. Issue #25 asks for an Owners list that staff can page through and sort.

## What Changes

- The Owners list is shown **one page at a time** instead of all at once, so the screen stays fast no matter how many owners exist.
- Staff can choose **how many owners to see per page — 5, 10, or 20** (10 by default).
- Staff can **sort the list by owner Name or by City**. Address, telephone, and pets are still shown, but the list is not sorted by them.
- Owner names are shown **surname first** (e.g. "Smith, John") so that once the list is sorted by name it reads in alphabetical order at a glance — fixing today's confusing "first-name-first" display.
- The existing **"find by last name" search keeps working** and combines with paging and sorting; starting a new search returns to the first page.
- **BREAKING**: the Owners list is now delivered as a single page plus a total count, rather than the whole list at once. Any other software that currently reads the full Owners list will need to be updated to read it page by page. *(The technical shape of this change is described in design.md.)*

## Capabilities

### New Capabilities
- `owners-listing`: Browsing the owners list one page at a time — choosing page size, sorting by Name or City, and searching by last name — kept fast at around one million owners.

### Modified Capabilities
<!-- None: this is the first spec for the owners list. -->

## Impact

- **The Owners list feed** other software reads changes shape — a breaking change for any consumer.
- **The Owners screen** gains paging, a page-size chooser, and sortable Name and City columns.
- **The stored owner data** gets performance work so paging, sorting, and searching stay fast at ~1 million owners.

*Detailed technical impact — affected components, data-store changes, and generated files — is listed in design.md.*
