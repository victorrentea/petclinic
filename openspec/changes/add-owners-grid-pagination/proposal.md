# Proposal

## Why

We expect around 100,000 pet owners within a year. Today the Owners screen loads every owner at once: fine for
26, unusable for 100,000. GH #25 asks for an Owners list that shows a few rows at a time and can be sorted.

While looking at the real data we also found that names with accents are sorted wrongly today: Śliwiński comes
after Wensleydale instead of right after Silver.

## What Changes

- The Owners screen shows **10 owners at a time**, with a choice of 5, 10 or 20, buttons for first / previous /
  next / last page, and a counter such as "1 – 10 of 26".
- Owners can be sorted by **Name** or by **City**, A→Z or Z→A. By default they are sorted by name.
- **Address, Telephone and Pets cannot be sorted** — a deliberate change from "any column" in the request:
  - addresses are written freely ("671 Lincoln Boulevard", "ul. Floriańska 14", "Calle de Alcalá 42"), so an
    alphabetical order of them means nothing;
  - the same phone country is written three ways (+44…, (0044)…, 0044…), so British numbers would end up in three
    different places of the list;
  - every owner has 1 or 2 pets, so sorting by them barely changes the order.
- Names with accents are sorted the way people read them (Śliwiński next to Silver).
- Owners are written last name first ("Potter, Harry"), since that is what the list is sorted by; the
  arrows on Name and City are always visible, white on the column currently sorted.
- Text too long for its column ends with "…"; pointing at it shows the whole text.
- Each pet shows a small picture of its kind (🐱 cat, 🐶 dog…).
- The search box, Find Owner and Add Owner sit on one line above the list.
- Searching by last name keeps working and its results are paged and sorted the same way.
- After opening an owner and pressing Back, the user lands on the same page, with the same sorting and search.
  A link to that page can be shared with a colleague.
- Changing the search, the page size or the sorting starts again from the first page.

## Capabilities

### New Capabilities
- `owner-list`: finding an owner by browsing, sorting and searching the list of owners.

### Modified Capabilities
<!-- none -->

## Impact

- **Who notices**: everyone using the Owners screen; nothing changes on the other screens.
- **Not included**: search ignoring upper/lower case ("po" does not find "Potter" today) — a separate request.
- Technical impact (API, database, tests) is described in `design.md`.
