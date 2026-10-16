# Proposal

## Why

Today the Owners page shows every owner of the clinic on one long screen. That works for the 26
owners we have now, but the business expects about 10,000 owners within a year. At that size the
page would take long to open, and finding someone by scrolling would no longer be practical.

Issue #25 asks for the list to be shown a page at a time, and for staff to be able to reorder it.

## What changes for the people using the clinic app

- **A page at a time.** Staff choose 5, 10 or 20 owners per page and move between pages. The
  page shows how many owners there are in total.
- **Sorting by name or city.** Clicking the *Name* header orders owners alphabetically by first
  name, then last name; clicking *City* groups them by city. Clicking the same header again
  reverses the order. An arrow shows which column the list is sorted by.
- **A sensible start.** The page opens on the first 10 owners, sorted by name from A to Z.
- **Search keeps working.** Searching by last name still works, and the results are paged and
  sorted the same way. A new search starts again from the first page and keeps the chosen order.
- **The page remembers where you were.** After opening an owner's details and going back, or
  after refreshing the browser, staff land on the same page, in the same order, with the same
  search. A link to that view can be shared with a colleague.
- **No dead end when nothing matches.** If a search finds nobody, the page says so and still
  offers *Add Owner*. Today that button disappears exactly when it is most needed.

## What we deliberately leave out

- **Address, Telephone and Pets cannot be sorted.** We looked at the real data before deciding:
  - Addresses sometimes start with a house number and sometimes don't ("12 Boltzmanngasse",
    "Diagon Alley").
  - Phone numbers are written in four different styles ("+44…", "(0044)…", …).
  - An owner can have several pets.

  Sorting any of these would produce an order that looks random. Tidying up the phone numbers
  could be a request of its own.
- **Other lists stay as they are.** Pets, vets and visits are not part of this request.

## Capabilities

### New Capabilities

- `owner-listing`: browsing the clinic's owners page by page: sorting, searching by last name,
  and remembering where the user is.

### Modified Capabilities

(none)

## Impact

- **Who notices:** clinic staff using the Owners page. Nothing else in their workflow changes.
- **Other systems:** the chatbot finds owners another way and is not affected. The owner count
  on the welcome page stays as it is.
- **Release:** the web page and the server behind it ship together. No data is migrated, and
  undoing the change is a plain rollback.
- **For engineers:** the change to the owners API is a breaking change. It is described, with
  every affected file, in design.md.
