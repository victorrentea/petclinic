## Why

The Owners screen shows the entire client list on one enormous page. With around ten thousand
owners on the books, that page is slow to open, unpleasant to scroll, and impossible to scan.

It also cannot be reordered. Staff can only narrow it down by typing the beginning of a surname —
if you want to see who your clients in a given town are, there is no way to ask for that.

This is what issue #25 asks us to fix: let staff sort the list, and show it in manageable chunks.

## What Changes

- **The list arrives in pages.** Ten owners at a time by default, and staff can switch to five or
  twenty. There are controls to move between pages and a count of how many owners there are in
  total. The screen only fetches what it is about to show.

- **Two columns become clickable to reorder the list: Name and City.** Clicking a heading sorts by
  it; clicking again reverses the order.
  - *Name* is the column staff already use to find a person.
  - *City* is the only way to group clients by where they live — we have no other way to ask that
    question today.
  - **Address, Telephone and Number of pets stay unsorted, on purpose.** Sorting addresses puts
    "14 Kensington Gardens" before "221B Baker Street" because it compares them character by
    character, and it mixes streets from different countries together — it looks broken. Sorting
    telephone numbers accidentally groups them by country prefix. And because almost every owner
    has none, one or two pets, sorting by that would just shuffle everyone into three clumps.
    Each of these would generate support calls, and nobody has asked for them.

- **The Name column will read "Darling, Wendy" instead of "Wendy Darling."** The list is ordered by
  surname, the same way the search box above it works, so the surname needs to come first — otherwise
  the ordering looks wrong to the eye. This is a visible wording change on screen.

- **Alphabetical order will finally be alphabetical.** Today the list is sorted the way a machine
  compares text, not the way a person alphabetises: surnames like "van Gogh" or "de Vries", and any
  name with an accent such as "Ångström", get dumped at the very end of the list, after Z. They will
  now appear where staff expect to find them.

- **The list will stay fast as the clinic grows.** Opening a page of owners will no longer get slower
  as we take on more clients.

- **Sharing a view will work.** The web address will carry which page, ordering and search the person
  is looking at, so staff can bookmark a view, send it to a colleague, and use the browser's back
  button.

- **The screen will still look like the rest of the application.** It must be indistinguishable from
  the Vets screen next to it.

- **The Owners screen and the server behind it have to be released together.** One will not work with
  the old version of the other. No other part of the product is affected, and no data is lost or
  changed.

**Not included, deliberately:** the surname search still distinguishes capital letters, so searching
"dav" finds nothing while "Dav" does — a separate annoyance we are raising as its own issue, not
fixing here. The Vets screen keeps its current behaviour for now.

## Capabilities

### New Capabilities
- `owner-listing`: what the system guarantees about the owner list it hands out — that it comes in
  pages of a sensible size, that it can only be ordered by the columns we agreed on, that paging
  through the whole list never shows the same person twice or skips anyone, and that alphabetical
  order matches human expectations.
- `owner-grid-ui`: how the Owners screen behaves for the person using it — the page-size choice,
  the clickable column headings, how the name is written, how ordering and searching interact, and
  looking consistent with the rest of the application.

### Modified Capabilities
<!-- None — no capability specs exist yet, so nothing previously agreed is being changed. -->

## Impact

**Who sees a difference:** anyone using the Owners screen. The change is visible immediately — a
shorter list with paging controls, two clickable column headings, and surnames written first.

**Release:** the Owners screen and the server must go out together. Rolling back means putting both
back. No owner data is modified or lost.

**Documentation and training material go stale.** The user manual currently promises the screen
"shows every registered owner", which stops being true, and the accompanying screenshot needs
retaking. Any training material showing the Owners grid will show the old wording.

**Approvals needed:** parts of this change touch areas that require sign-off from the technical
elders before merging. The full list of technical work, the trade-offs behind each decision, and the
measurements they are based on are in `design.md`.

**Decisions we need from you** (also listed at the end of `design.md`):
1. Is "Darling, Wendy" acceptable in the manual and in training material, or do you want the name
   written the old way even though it makes the ordering look wrong?
2. Should the Vets screen get the same treatment in a follow-up, or stay as it is?
