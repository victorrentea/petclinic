# Proposal

## Why

The Owners screen loads every owner at once, in no particular order. The clinic expects around 100,000 owners by September 2027: that screen would take too long to open and be impossible to scan. Staff need to find owners by name or city and move through them a page at a time (GH #25).

## What Changes

- The Owners screen shows owners **one page at a time**: 5, 10 or 20 per page, 10 by default.
- Staff can **sort by Name or by City**, ascending or descending. The first visit shows names A→Z.
- Name sorts the way it is displayed: first name, then last name ("Kevin McCallister" before "Kevin Smith").
- Address, Telephone and Pets cannot be sorted: house numbers and mixed phone formats have no meaningful order, and an owner has several pets or none.
- The page shows the total number of owners found, so staff see where the list ends.
- The last-name search keeps working as today, now combined with paging and sorting. A new search, a new sort or a new page size returns to the first page.
- The current page, page size, sort and search are kept in the address bar: refreshing, going Back or sending the link to a colleague shows the same page.

```
 Owners
 Last name [ Mc________ ] [Find Owner]

 ┌─────────────────────┬──────────────────┬───────────┬────────────┬──────┐
 │ Name ▲              │ Address          │ City ⇅    │ Telephone  │ Pets │
 ├─────────────────────┼──────────────────┼───────────┼────────────┼──────┤
 │ Kevin McCallister   │ 671 Lincoln Blvd │ Chicago   │ 6085551749 │ Milo │
 │ Kevin McCarthy      │ 27 Baker St      │ London    │ 0044…      │      │
 │ …                   │                  │           │            │      │
 └─────────────────────┴──────────────────┴───────────┴────────────┴──────┘
          Rows per page: [10 ▾]    11 – 20 of 57    |◀  ◀  ▶  ▶|
                         5/10/20

 ▲ / ▼  sorted column, click to flip        ⇅  sortable, click to sort by it
 Address, Telephone, Pets: not sortable
```

- **BREAKING** for anything that reads the owners list directly (other programs, test scripts): it now returns one page plus a total, never the whole list.

Out of scope: the six leftover "Ada Acceptance…" test owners in the dev database — a separate issue.

## Capabilities

### New Capabilities
- `owners-grid`: browsing the owners list page by page, sorted by name or city, filtered by last name.

### Modified Capabilities
<!-- none: openspec/specs/ is empty -->

## Impact

- Owners screen (frontend) and the owners list in the REST API.
- The shared API contract (`openapi.yaml`) changes; its reviewers must approve.
- A database migration adds indexes; the dev database must be reset once.
- Automated tests that read the full owners list are adapted.
- The chatbot and MCP tools are unaffected.
