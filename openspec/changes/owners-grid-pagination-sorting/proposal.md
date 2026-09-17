## Why

Issue #25 asks that the Owners list can be sorted by any column and browsed in pages of 5, 10, or
20. Right now the app loads every owner at once and sorts/filters them in the browser. Our business
expects the number of owners to grow to about 100,000 within a year, and at that size "load
everything, then sort in the browser" stops being a nice-to-have optimization — it becomes a page
that simply won't load in reasonable time. A previous contributor claimed this had already been
built, but that turned out not to be true; nothing in the app today actually pages or sorts on the
server.

## What Changes

- The Owners list starts fetching one page of results at a time from the server, instead of
  downloading the entire list. This is a breaking change to how the app talks to the server —
  anything else that reads the owners list would need to be updated too (see Impact).
- Users can pick a page size of 5, 10, or 20 rows; the default is 10.
- Users can click the Name or City column headers to sort by that column. `Address` and
  `Telephone` are not made sortable: we checked the data and almost every owner has a unique
  address and phone number, so alphabetically sorting either one wouldn't group anything
  meaningfully — it's not a useful way to browse the list. `Pets` also stays unsortable, since each
  owner can have several pets and there's no single value to sort by.
- If someone asks for a page larger than 20 rows, or asks to sort by something that isn't one of
  the supported columns, the request is refused with a clear error instead of quietly being
  allowed or crashing.
- Sorting is made predictable: an owner with a blank value in the sorted column always shows up
  after the ones that have a value, no matter which direction you sort in, and rows never shuffle
  between pages or get duplicated/skipped when many owners tie on the same value (e.g. same city).
- Searching by last name now always jumps back to the first page of results, keeping whatever
  sorting was already selected.
- The Name column keeps showing "Last name, First name" in one column (not split into two), and
  sorts by last name first.
- A long-standing display bug is fixed along the way: today's Pets column renders invalid markup
  that inflates the table with extra empty rows; this gets cleaned up as part of rebuilding the
  grid.
- Automated tests and checks that rely on the current owners list (including one end-to-end test
  that assumes all owners appear on one page) are updated to match the new paged behavior, and a
  new test is added to cover paging itself.

## Capabilities

### New Capabilities
- `owners-list-pagination`: paged, sortable, filterable owners list — how many results come back
  per request, which columns can be sorted, what happens on invalid requests, how ties and missing
  values are ordered, and how the Owners screen behaves for the user.

### Modified Capabilities
(none — no existing spec covers the owners list today; this introduces a new capability rather
than changing a documented one)

## Impact

- **Owners screen**: the list view is rebuilt to fetch, sort, and page results from the server.
- **Server API**: the endpoint that returns the owners list changes shape and gains paging/sorting
  options; anything else calling that same endpoint needs to be updated in step. We checked: the
  chatbot and the vet-ambulance assistant only ever look up a single owner by ID, so they are not
  affected.
- **Database**: a supporting index is added so sorting stays fast as the table grows.
- **Automated tests**: backend tests, and the end-to-end browser tests, are updated for the new
  behavior; one existing end-to-end scenario is rewritten and a new paging scenario is added.
- **AGENTS.md**: already records the ~100,000-owner growth expectation and the rule that paging,
  sorting, and filtering belong in the database, not the browser — this change is the reason that
  rule exists.

All technical implementation choices (API shape, indexing strategy, framework components, code
changes) are documented in `design.md`, not here.
