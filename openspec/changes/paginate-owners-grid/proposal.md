## Why

The Owners screen shows every owner in the clinic at once, in no particular order. That is
tolerable with the 30 owners we have today and unusable at the scale we are aiming for — roughly
100,000 owners within a year. A receptionist looking for someone has no way to order the list and
no way to move through it; the screen simply gets slower and longer as the clinic grows.

Issue #25 asks for a sortable, paginated Owners grid.

## What Changes

- The Owners grid shows **one page at a time**, defaulting to 10 owners per page, and the user
  can switch between **5, 10 or 20** rows per page.
- The user can **order the grid by Name or by City**, ascending or descending, by clicking the
  column header. Those two columns become clickable and show which way they are sorted.
- The Name column is **written surname first — "Baskerville, Henry"** instead of "Henry
  Baskerville". Ordering people by surname is what a clinic means by sorting names, but as long
  as the given name is printed first the ordered column reads as random — the eye follows the
  first letter, which jumps A, H, J, S, G. Printing the surname first makes the order visible,
  and it matches the search box, which already asks for a last name. An owner's own page is
  unaffected and still greets them by given name first.
- **Address, Telephone and Pets are deliberately not sortable.** This is narrower than the issue
  asks, and the reason is what the real data does: addresses begin with a house number, so
  ordering them puts "110" before "26"; telephone numbers have different lengths and one owner
  has none, so the ordering changes meaning depending on direction; and no owner has more than
  two pets, so ordering by Pets produces three indistinguishable groups. Each of those would read
  as a bug rather than a sort.
- **The existing last-name search keeps working** and combines with the above: searching narrows
  the list first, and the result is shown from its first page.
- **Moving through pages is reliable**: every owner appears on exactly one page, including owners
  who share a last name or a city. Today's list has two Potters, two Darlings and six owners in
  London, all of which could otherwise be shown twice or skipped.
- **The grid is linkable**: the search text, the page, the page size and the ordering all live in
  the browser address bar, so a link points at what the sender was looking at and the back button
  returns to it. Today the screen forgets the search text as soon as you open an owner.
- **BREAKING for anything reading the owners list programmatically**: the list is no longer
  returned in full. Callers receive one page plus the total count. The clinic's own web app is the
  only thing that reads this list today, and it ships together with the server, so nothing outside
  our own release is affected.

## Capabilities

### New Capabilities
- `owner-directory`: browsing the clinic's owners — filtering by last name, ordering the result,
  and retrieving it one page at a time.

### Modified Capabilities
<!-- none: no specs exist in this project yet -->

## Impact

- **Owners screen** — new sortable headers, a page control, and the Name column written surname
  first; nothing else about a row changes.
- **Owners list service** — returns a page and a total instead of everything.
- **Automated test suites** — the checks that read the owners list need updating, including one
  that currently asserts "every owner in the clinic is listed", which stops being true once the
  screen shows a page. It becomes "the first page of them is listed".
- **Not included**: cleaning up the leftover test rows that acceptance runs have left in the
  development database (they sort to the top of the list by name), and sorting by number of pets.

Technical decisions, alternatives and risks are in design.md.
