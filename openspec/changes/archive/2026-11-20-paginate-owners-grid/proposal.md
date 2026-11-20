# Proposal

## Why

Today the Owners screen loads every owner in the clinic at once. That's fine with a few dozen owners,
but the product owner expects about 100,000. At that size the screen would take ages to open, or
freeze. Issue #25 asks for a list you can sort, showing 5, 10 or 20 owners at a time.

The decisions come from `Q&A.md`. Victor has decided two of them. The others are recommendations
still to be confirmed with the Three Amigos; anything they change gets changed here before the work
starts.

## What Changes

- **One page at a time.** The list shows 5, 10 or 20 owners, 10 to start with. Below it, the user
  sees something like "11 – 20 of 4,312" and buttons for the next, previous, first and last page.
- **Sort by Name or City.** Clicking the "Name" or "City" heading sorts A→Z; a second click sorts
  Z→A. The other columns don't sort. Addresses start with a house number and phone numbers are
  written in different ways, so sorting them would give an order nobody can use.
- **Accented names land where people expect.** "Śliwiński" sorts with the other S names, not
  after Z as it does today.
- **Nobody gets lost between pages.** Two owners with the same name always come in the same order,
  so when you flip pages nobody shows up twice and nobody gets skipped.
- **Search works as before.** Typing the start of a last name still filters the list (upper- and
  lowercase still matter). The total now counts only the matching owners.
- **Page 1 after a new search or a new sort.** Otherwise you might land on, say, page 7 of a much
  shorter list and see nothing. Changing how many owners fit on a page keeps the owner you were
  looking at on screen.
- **The browser address remembers where you are.** The Back button, a refresh, or a link sent to a
  colleague all bring back the same search, sort and page.
- **A clear message when nothing matches.** "No owners with last name starting with …" replaces an
  empty table.
- **BREAKING, for programmers only:** our server now hands the owners list over one page at a time.
  Any other program that expects the full list would have to change. We checked: only our own
  Owners screen reads it, and it changes together with the server.

Not in this change: searching by city or phone, cleaning up phone numbers, sorting by number of
pets, and searching without caring about upper/lowercase. Each can be its own request later.

## Capabilities

### New Capabilities
- `owner-listing`: how the clinic's server hands out the list of owners, one page at a time and in
  the order asked for.
- `owners-grid`: what a user sees and can do on the Owners screen.

### Modified Capabilities
None. These are the project's first written specs.

## Impact

- **Users:** only the Owners screen changes, as described above. Every other screen stays the same.
- **Speed:** the screen opens just as fast with 50 owners as with 100,000.
- **Risk:** sorting accented names correctly needs a feature our database may not have installed.
  It's the first thing we check; if it's missing, we come back with options before building
  anything.
- **For developers:** the affected code, database and tests are listed in `design.md`, under
  "Technical impact".
