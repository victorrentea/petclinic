# Proposal

## Why

Today the Owners screen loads every owner, with all their pets, in one go. That works with the
26 owners we have now. We expect about 50,000 owners within a year, and then the screen would
become slow and hard to use. Issue #25 asks for an Owners list that can be sorted and shows
one page at a time. All decisions below were agreed on 2026-10-23 (see Q&A.md).

## What Changes

- **One page at a time.** The Owners list shows 5, 10 or 20 owners per page (10 by default),
  with buttons to move between pages and the total number of owners.
- **Sorting by Name or City**, ascending or descending, by clicking the column header.
  By default, the list is sorted by Name, A→Z.
  - Name sorts by **first name**, then last name.
  - Owners with the same name keep the same order every time, so nobody jumps between pages
    or appears twice.
  - Names with accents (for example *Śliwiński*) sort alongside the same letters without
    accents, as people expect, not at the end of the list.
- **Address, Telephone and Pets cannot be sorted.**
  - Address: the stored addresses are messy, so any order would look random.
  - Telephone: numbers are stored in mixed formats (`+44…`, `(0044)…`, `0119…`), so sorting
    them would give a meaningless order. Cleaning up the phone formats is a separate topic.
  - Pets: sorting owners by their pets would slow down every page, and there is no ordering
    that would make sense to users.
  - A comment on issue #25 explains these reasons.
- **Search by last name still works.** It narrows the list first, then the results are paged.
  The total shown is the number of matching owners.
- **The list returns to page 1** when you start a new search, change the page size, or change
  the sort. A new search keeps your chosen sort.
- **An empty result is shown clearly.** When no owner matches, the screen shows "No owners…"
  instead of an empty table.
- **Refresh and Back keep your place.** Reloading the page or coming back from an owner's
  details shows the same page and sort. *This is optional and can be dropped if it delays
  delivery.*

## Capabilities

### New Capabilities
- `owner-listing`: how clinic staff browse owners: search by last name, page through the
  results, and sort them.

### Modified Capabilities
_None._

## Impact

- **Users** see a faster Owners screen that stays usable as the clinic grows.
- **Other systems** that read the full owner list must change at the same time as this release.
  Today that is only our own Owners screen. The chatbot is not affected.
- **Not included in this change:**
  - cleaning up phone number formats;
  - a response-time target for the Owners page (business has not given a figure yet).
