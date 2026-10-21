# Proposal

## Why

We expect about 50,000 pet owners within a year. Today the Owners screen loads every owner
at once each time it opens; with that many owners it would become slow and could bring the
application down. This change lets staff see owners a page at a time and put them in order.

## What Changes

- **One page at a time.** Staff choose 5, 10 or 20 owners per page (10 to start with), see
  how many owners there are in total, and move to the first, previous, next or last page.
- **Last name first.** The Name column shows "McCallister, Kevin", the way we write names in
  Romania, and that is also the order names are sorted in.
- **Sort by Name or City.** Clicking a column title sorts A to Z; clicking again sorts Z to
  A. Owners from the same city appear in name order. An owner never shows up on two pages.
- **Address, Telephone and Pets cannot be sorted**, as agreed. Addresses and phone numbers are
  typed in many different ways ("12 Boltzmanngasse" vs "Boltzmanngasse 5"; "+44…" vs
  "(0044)…"), so any order would look broken; Pets is a list of names.
- **Romanian alphabetical order.** Ș comes after S and Ț after T, the same everywhere the
  application runs.
- **Search works as before**, by the start of the last name, and now combines with paging. A
  new search, a different sort or a different page size goes back to the first page.
- **Two small fixes on the same screen:** each owner's pets are listed as "Nana, Tinker",
  and the Add Owner button stays available when a search finds nobody.

**Not included:** returning to the same page after opening an owner and pressing Back (staff
land on the first page); finding "Mureșan" by typing "Mures"; showing last name first on other
screens.

## Capabilities

### New Capabilities
- `owner-list`: finding an owner on the Owners screen — searching by last name, paging, and
  sorting.

### Modified Capabilities
None.

## Impact

- **Front-desk staff** get a faster Owners screen, with paging and sorting.
- **Nothing else changes for users**: the chatbot and the other screens behave as today.
- Released in one go, with no downtime expected. Engineers review the technical side
  separately.
