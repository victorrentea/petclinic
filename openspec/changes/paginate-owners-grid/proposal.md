# Proposal

## Why

The business expects about 100,000 pet owners in the system within a year. Today the
Owners screen loads every owner, with all their pets and visits, every time it opens. At
that size the screen becomes slow and the server is at risk of running out of memory.
GitHub issue #25 asks for the fix: show owners a page at a time and let staff sort them.

## What Changes

What the new screen looks like: `mockup/owners-grid.png`, and the same screen with the open
questions pinned on it in `mockup/owners-grid-notes.png`. Open `mockup/owners-grid.html` in a browser
to try it with the clinic's sample owners: sorting, paging and search all work.

- **The Owners screen shows one page at a time.** Staff choose 5, 10 or 20 owners per page
  (10 by default), see how many owners there are in total, and move between pages.
- **Staff can sort by Name or by City**, ascending or descending, by clicking the column header.
  - Name sorts by first name, then last name — the same order the name is shown in
    ("Kevin McCallister" is under K).
  - City sorts by city; owners in the same city are then sorted by name.
- **Address, Telephone and Pets cannot be sorted.** The data would make any order look broken:
  - Addresses are typed freely, so "110 …" comes before "12 …".
  - Phone numbers are stored in several formats ("+44…", "(0044)…", "0119…"), so numbers
    from one country would be scattered across the list.
  - An owner has between 0 and 2 pets, so there is nothing meaningful to sort them by.
- **Searching by last name works as before** (it is still case-sensitive) and now combines
  with paging. A new search, a different page size or a different sort goes back to page 1.
- **Staff keep their place.** After opening an owner and pressing Back, or after refreshing
  the browser, they return to the same page with the same sort and search.
- **"No owners found" means no owners matched.** Today the same message also appears when
  the server fails. A failure will show as an error instead.
- **BREAKING for other systems:** anything that asks the server for "all owners" will now get
  one page of at most 100 owners. Every system that asks today is part of this project and
  changes together with it, so nothing outside it is affected.

## Capabilities

### New Capabilities
- `owner-list`: browsing the clinic's owners — searching by last name, paging and sorting.

### Modified Capabilities
<!-- none: no capability is documented yet -->

## Impact

- **Staff** get a faster Owners screen that stays fast as the clinic grows. They lose the
  ability to see every owner at once, and to sort by address, telephone or pets.
- **Other systems** reading the owner list must ask for it page by page (see BREAKING above).
- **Not included in this change:** searching regardless of upper/lower case, cleaning up the
  stored phone-number formats, and removing the test owners the automated tests leave behind
  in the development database. Each one can be its own request.
- The technical details (how the server, database and screen change) are in `design.md`, and
  the exact expected behaviour, as testable examples, is in `specs/owner-list/spec.md`.
