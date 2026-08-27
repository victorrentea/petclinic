## Why

The Owners screen shows every owner in the clinic on a single, unbroken list. That is fine with the
handful of demo owners we have today, and unusable at the volumes the business expects: **10,000 —
possibly 100,000 — owners within a year**. Long before that, the screen becomes slow to open and
impossible to scan.

GitHub issue #25 asks for a list that can be sorted and browsed page by page. The full decision
record behind this change — every option considered and why one was chosen — is in
[`Q&A.md`](../../../Q&A.md); the technical shape of the solution is in `design.md`.

## What Changes

- The Owners list is shown **one page at a time**, with the user choosing **5, 10 or 20 rows per
  page** and 10 by default. The clinic's whole owner base is never loaded into the browser again.
- The user can **sort the list by Name or by City**, ascending or descending, and the sorting applies
  to *all* owners — not just the ones on screen.
- **Not every column becomes sortable**, contrary to the wording of issue #25. Address, Telephone and
  Pets get no sort control: sorting them produces results that look broken to the user (addresses
  starting with a house number, phone numbers grouped by country prefix with one owner missing a
  number, and a pet list that is not a single value to sort on). Issue #25 should be updated to say so.
- The **Name column now reads "Potter, Harry"** instead of "Harry Potter", so that what the user sees
  is exactly what the list is sorted on and what the search box searches for. Approved by business.
- **Searching resets the user to the first page** and keeps the sorting they had chosen.
- The **page the user is on is part of the address bar**, so the browser's Back button returns them
  to where they were, and a link can be sent to a colleague showing exactly the same page.
- The list keeps its **current look**; no visual redesign, only sort arrows on two column headers and
  a small pager at the bottom.

**Deliberately unchanged:** the screen still loads each owner's pets and visits the same (inefficient)
way it does today — that behaviour is the subject of this project's training material and removing it
would delete the lesson; it is a known cost, recorded in `design.md`. Who is allowed to see the
Owners list is also unchanged.

**One consequence worth naming for planning:** the way this data is served to the screen changes
shape, so everything in this project that reads the owners list has to be updated in the same change.
Nothing outside this project consumes it. Details in `design.md`.

## Capabilities

### New Capabilities
- `owners-list`: browsing the clinic's owners — pages and page sizes, which columns can be sorted and
  how, what a search does to the current page, how a name is displayed, and returning to the page the
  user left.

### Modified Capabilities
<!-- None: openspec/specs/ is empty, so no existing capability's requirements change. -->

## Impact

- **Who notices:** anyone using the Owners screen — the list gains a pager and two sort arrows, and
  names read "Potter, Harry".
- **What has to move with it:** the Owners screen, the service that feeds it, the automated test
  suites that check it, and the screenshot in the user manual.
- **Not affected:** the assistant/chatbot, the vets and visits screens, and who is allowed to see
  owners.
- **Rollout:** screen and server must be released together; there is no half-way state. Reverting is
  a plain revert.
