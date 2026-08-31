## Why

The owners screen shows **every owner in the clinic at once**, in a single list. With today's
26 owners nobody notices. The business plans for **~100.000 owners within one to five years**
(stated 2026-08-31), and at that size the screen stops being usable long before it stops
working: the page takes many seconds to appear, and nobody scrolls a list of a hundred
thousand people to find one.

Issue #25 asks for a paged, sortable owners grid. The important part of the decision is
*where* the paging happens: the clinic's system must send the browser **one page of owners at
a time**, instead of sending all of them and letting the browser show twenty. At a hundred
thousand owners, the second approach is not slow — it is broken.

There is a second reason, less visible but worse. When the list is ordered by a value many
owners share — City, for example, where London already appears seven times — the system has no
rule for which of the tied owners comes first. Measured on the real data, asking for the same
page twice can return **different owners**, and at scale two consecutive pages can have no
owner in common: an owner can be missing from every page, or appear on two. Anyone using the
grid to work through owners one page at a time would silently skip people. This change fixes
that ordering rule as well.

## What Changes

- **Owners are listed one page at a time.** The user chooses 5, 10 or 20 owners per page and
  moves between pages with a standard paginator that also shows how many owners match. There
  is deliberately **no "All"** option — offering it would just re-create today's problem.
- **The grid opens on the first 10 owners, ordered alphabetically by last name.** Today it
  opens in no particular order at all.
- **The Name column now reads "Potter, Harry"** instead of "Harry Potter", so that what the
  column shows is what it is sorted by. A list of people sorted by family name but printed
  first-name-first looks broken — the reader sees the surnames in order only if they read past
  the first word of every row. This is a directory, and directories are written surname-first.
- **Name and City are sortable** by clicking the column header. Sorting by Name means by
  family name, then by first name — so the two Potters land together.
- **Address, Telephone and Pets are not sortable** — see the deviation below.
- **The order is now guaranteed stable.** Paging through the whole grid shows every owner
  exactly once, never twice, never zero times — including when many owners share a city.
- **Searching by last name returns to the first page**, keeping the chosen sort. Otherwise a
  user on page 5 who searches for "Pot" would see an empty grid.
- **The grid's state lives in the page's address.** Which page, how many per page, which sort
  and which search are all in the URL, so a view can be bookmarked, shared with a colleague,
  and survives a browser reload.
- **BREAKING for anything reading the clinic's owner list programmatically.** The list is no
  longer delivered as one unbounded batch. The only consumer in production is our own web
  application, and it ships in the same release, so no user-visible interruption is expected.

### Where this deliberately differs from the issue

Issue #25 asks for the grid to be "sortable by **any** column". We propose sorting by **Name
and City only**, and here is the reasoning in business terms:

- **Address** — sorted as text, "4 Privet Drive" lands after "30 Wellington Square", because
  "3" comes before "4" character by character. Also, 27 of our 28 owners have a distinct
  address, so sorting groups nothing together.
- **Telephone** — sorting phone numbers as text orders them by their leading digits, which is
  the country/area prefix. Nobody looks for an owner that way.
- **Pets** — every owner has 0, 1 or 2 pets, so sorting produces three large blocks rather
  than an order.

None of these produce an order a person would actually ask for, and each one is an extra way
to make the system do expensive work. If the PO wants any of them anyway, it is a small
addition — but it should be a deliberate choice, not a side effect of the word "any".

**This deviation is to be posted as a comment on issue #25 before implementation starts**, so
the decision lives in the ticket rather than only in this document.

## Capabilities

### New Capabilities
- `owners-grid`: how the clinic's owners are listed to a user — filtered, ordered, and
  delivered one page at a time — and how the owners screen behaves on top of that.

### Modified Capabilities
<!-- None: this is the first capability captured in openspec/specs/. -->

## Impact

**Who notices:** anyone using the owners screen. The screen gains a paginator and two sortable
column headers; it loses nothing.

**What it costs:** work across the web application, the clinic's back-end service and the
database, plus the automated tests that cover the owners screen. All of it lands in one
release — see `design.md` for the technical breakdown and `tasks.md` for the sequence.

**What needs a human before it ships:** the change touches two files that require review by
`@victorrentea/elders` — the published description of our API, and a database change. This is
a pull request that cannot be merged unattended.

**What this change explicitly does not do:**
- It does not change *how* owners are searched — the search stays a case-sensitive match on
  the beginning of the last name. Making search smarter (partial matches, typo tolerance) is a
  separate request.
- It does not add sorting by number of pets.
- It does not add an "All" page size.
- **It does not touch any other list in the application.** Vets, pets, visits and users keep
  behaving exactly as they do today. Paging them is the same conversation, but it is a
  separate request — the owners list is the one the volumetry makes urgent.
