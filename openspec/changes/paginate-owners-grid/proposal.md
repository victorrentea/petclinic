# Proposal

## Why

The Owners screen shows every owner at once, in one long list with no particular order. The
clinic plans to have about 50,000 owners within a year: by then the screen would take long to
open and nobody could find anyone by scrolling. (GitHub issue #25.)

## What Changes

- **Owners come page by page.** The screen shows 10 owners at a time; staff can switch to 5 or 20
  per page, see where they are ("1 – 10 of 29") and move to the next or previous page.
- **Sort by Name or by City.** Clicking a column heading sorts by it; clicking it again reverses
  the order. The screen opens sorted alphabetically by name.
- **Address, Telephone and Pets do not sort.** The issue asked for "any column", but their order
  would mean nothing: addresses start with house numbers or have none, phone numbers mix
  country prefixes with local numbers, and an owner has several pets.
- **Names read "McCallister, Kevin"**, last name first as in a register, so the alphabetical
  order is obvious at a glance. This applies everywhere an owner's name appears: the Owners
  list, the owner's page, the Visits list, and the pet and visit forms. Vets' names do not change.
- **Search by last name works as before**, and its results are paged and sorted the same way.
  A new search, a new sort or a new page size starts again from the first page.
- **The screen keeps its place.** Refreshing the page, sharing its link or coming Back from an
  owner's record shows the same search, sort, page and page size.
- **Pets fit on one line**, separated by commas, so every row has the same height. When they do
  not fit, a ▾ unfolds them one under another.
- **No match, no empty table**: a short, friendly message suggests checking the spelling or
  adding the owner.

![The Owners screen after this change: sorted by name, 10 rows per page](mockup/owners-grid.png)

**Not in this change:** search stays by the beginning of the last name, with capitals and small
letters matched exactly as today. (Remembering the page was out of scope until the first review
of the screen, on 5 Oct, asked for it.)

## Capabilities

### New Capabilities
- `owner-grid`: browsing owners page by page, searched by last name, sorted by name or city.
- `owner-name-display`: how an owner's name is written on every screen.

### Modified Capabilities
<!-- none: no specs exist yet in openspec/specs/ -->

## Impact

- **Front desk staff**: a new way to browse owners, and owner names written the other way round
  on every screen.
- **Testing**: every check that reads an owner's name now expects "Last, First"; a new
  end-to-end scenario covers sorting and paging.
- **User manual**: the Owners section and its screenshots are regenerated.
- **Pet owners and the chatbot**: not affected.
