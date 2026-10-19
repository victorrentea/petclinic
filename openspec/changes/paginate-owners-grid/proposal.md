# Proposal: Owners shown page by page

## Why

Today the Owners screen shows every owner on one long list, in the order they were entered. That is
fine for a few dozen owners, but the clinic hopes to reach 10,000 within a year. A list that long would
be slow to open and hard to find anyone in. Request #25 asks for the list to come in pages, in an
order the user can choose.

## What Changes

- **Pages.** Owners are shown 10 at a time, and the user can switch to 5 or 20 per page. The screen
  shows how many owners there are in total.
- **Page numbers built for halving.** Instead of previous/next arrows, the screen offers the first and
  last page, the pages next to the current one, and the pages halfway back to the start and halfway on
  to the end. On page 5 of 80 that is 1 … 3 4 5 6 … 43 … 80, so the user can home in on an owner the way
  one looks up a word in a dictionary.
- **Sorting by Name or City.** Clicking the column title sorts by it; clicking again reverses the
  order.
  - Names are shown surname first, as in "Liddell, Alice", and sort that way: by surname, then
    first name.
  - Within the same city, owners stay in name order.
  - Accented names such as Śliwiński or Mureșan sort where a reader expects them.
- **No sorting by Address, Telephone or Pets.** This was agreed after the demo: the addresses and
  phone numbers we hold are written in too many different ways for their order to mean anything.
- **Search works as before**, and its results come in pages too. A new search, a new sort or a new
  page size always starts again from page 1.
- **The screen remembers where you were.** Coming back from an owner's details, refreshing the page,
  or sending the link to a colleague shows the same page, order and search.
- **"Add Owner" stays available when a search finds nobody**, which is exactly when it is needed.
- **Problems are reported honestly.** If the list cannot be loaded, the screen says so instead of
  claiming there are no owners.

**Not included:**
- Cleaning up the inconsistent addresses and phone numbers.
- Removing some leftover test owners that currently appear in the list. They will be handled
  separately.

**Question for the business:** when you said "10,000 users", did you mean pet owners (the clinic's
clients) or staff accounts? This proposal assumes pet owners.

## Capabilities

### New Capabilities
- `owner-listing`: browsing the clinic's owners page by page, sorted by name or city, optionally
  narrowed down by surname.

### Modified Capabilities
<!-- none -->

## Impact

- Only the Owners screen changes. No existing data is changed or moved.
- The Owners section of the user manual is updated to match.
