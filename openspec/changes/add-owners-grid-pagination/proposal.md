## Why

The Owners screen shows every owner in the clinic on one long page. With 28 owners that is
merely awkward; the business expects **around 100,000 owners within a year**, and at that size
the screen becomes unusable — it would take a long time to appear, and finding anyone would mean
scrolling past tens of thousands of rows.

GH #25 asks for an Owners list that staff can **sort by column and read a page at a time**, in
pages of 5, 10 or 20 rows. This change delivers that, and makes the screen's cost independent of
how large the clinic grows: showing 10 owners takes the same time whether the clinic has 28 or
100,000.

## What Changes

**For the people using the Owners screen**

- The list arrives **one page at a time**, with a pager underneath showing which page you are on
  and how many owners matched. You choose **5, 10 or 20** rows per page.
- **Landing on the screen** shows the first 10 owners, sorted by name.
- **Clicking the Name or City heading sorts the whole list** — not just the page you can see —
  and clicking again reverses it. Sorting is on **Name and City only**: address and telephone
  are free text entered in inconsistent formats (and some owners have no telephone at all), so
  ordering by them would look arbitrary rather than helpful, and the Pets column holds a list
  per row, which has no order to sort by.
- **The Name column now reads `Potter, Harry`** instead of `Harry Potter`. The column sorts by
  surname, so this makes the order the reader sees match the order the list is in — and it keeps
  the two Potters, and the two Darlings, together. This was agreed with the business as part of
  the design interview.
- **Searching by last name takes you back to the first page** and keeps whatever sorting you
  had. Without this, a search matching two owners, run while you were on page 5, would show an
  empty screen and read as a broken search.
- **The address bar remembers where you are.** Reloading the browser, pressing Back, or sending
  a colleague the link all bring back the same search, sorting and page. Today all three lose
  your place.
- **The "no owners found" message works again.** It currently fails to appear in some cases; it
  will now show whenever a search matches nobody.

**Behind the screen**

- The system now sends only the rows for the page being viewed, rather than every owner, and
  does the sorting and searching centrally instead of in the browser.
- **Owners who share a surname keep a fixed order** across pages. Without this, the same owner
  could appear twice while another disappears entirely as you page through — a data-loss-looking
  bug that would be very hard to spot.
- The owners table gets the **look-up shortcuts it has never had**, so searching and sorting stay
  fast at 100,000 owners.

**BREAKING** — the way the Owners list is requested and delivered changes shape. Nothing outside
this project consumes it, so no external party needs to migrate, but the screen and the automated
test suite must be updated together, in one release.

## Capabilities

### New Capabilities
- `owners-listing`: browsing the clinic's owners — searching, sorting and reading the list a page
  at a time.

### Modified Capabilities
<!-- None: this is the first capability spec recorded in this project. -->

## Impact

**What the user sees change:** the Owners screen only. Owner details, adding and editing owners,
pets and visits are untouched.

**What we discovered while planning:** the design interview recorded that the Owners screen was
the only thing reading this list. That turned out to be wrong — **the automated end-to-end test
suite reads it too**, and three of its checks stop working under the new shape. Updating those
tests is part of this change, not a follow-up: the change cannot ship with a red test suite.

**One question the issue did not settle, now decided:** what should happen if something asks for
a page size other than 5, 10 or 20 — say 1,000 rows. **The request is refused**, rather than
quietly returning a different number of rows than were asked for, which is what would otherwise
happen. Decided 9 Sep 2026; the interview had not covered it.

**Review and release:** three of the files this change regenerates are under mandatory senior
review, so the release needs a reviewer from that group booked in advance rather than found at
the last minute.

**Deliberately not doing**

- **Not loading 100,000 test owners into the development database.** The paging arithmetic is
  proven with purpose-built test data instead; the 28 sample owners already exercise three pages.
- **Not optimising for someone jumping to page 5,000.** That works, just more slowly. It is a
  known ceiling, recorded rather than solved, and nobody browses that deep in practice.
- **Not resolving one open question about name ordering in production.** Names with accented
  letters — `Śliwiński` — sort correctly on our development machines because of how those
  machines are configured. If the production database is configured differently, that name would
  sort to the end of the list instead of among the S's. **This needs confirming with operations
  before go-live**; it is not something this change can settle on its own.
