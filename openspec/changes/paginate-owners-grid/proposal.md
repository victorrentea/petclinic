# Proposal

## Why

The Owners screen shows every owner of the clinic on one long page. That works today with a
few dozen owners, but we expect about **50,000 owners within a year**. At that size the
screen would take long to open, and nobody could find an owner by scrolling. Staff need to
browse owners a page at a time and put them in a useful order (gh #25).

## What Changes

- **Owners appear in pages.** Staff choose 5, 10 or 20 owners per page (10 to start with)
  and move between pages. The screen shows how many owners there are in total.
- **Owners can be put in order by name or by city**, A→Z or Z→A, by clicking the column
  title. By default they are listed by name: surname first, then first name.
- **Names with accents appear where you'd look for them.** "Śliwiński" is listed between
  "Silver" and "Tremaine", not after "Wensleydale" as a computer would put it by default.
- **Some columns can't be used for ordering, on purpose:**
  - **Address**: addresses are written in many different ways ("221B Baker Street",
    "Boltzmanngasse 5", "ul. Floriańska 14"), so the same street would end up in two places.
  - **Phone**: numbers are stored in different formats ("+44…", "(0044)…", "0044…"), so
    owners from the same country would be spread across the list.
  - **Pets**: an owner can have several pets, so there's no single value to order by.
- **The screen remembers where you were.** After opening an owner and going back, you're on
  the same page, in the same order. You can also send a colleague a link to exactly what
  you're looking at.
- **Searching starts again from the first page.** So does changing the order or the number
  of owners per page. A link to a page that no longer exists, for example because owners
  were removed since it was shared, opens the last page instead.
- **Searching works as before:** it matches the beginning of the surname, and capital
  letters must match ("Pot" finds Potter, "pot" does not).

**Not part of this change** (each one can be requested separately):
- A search that ignores capital letters and accents ("sliwinski" finding Śliwiński).
- Storing every phone number in one format, which would make the Phone column sortable too.
- Removing the duplicate test owners currently visible in the development environment.

## Capabilities

### New Capabilities
- `owners/owner-list`: browsing the clinic's owners: searching by surname, moving between
  pages, ordering them, and coming back to the same place.

### Modified Capabilities
<!-- none: this is the first capability described for the project -->

## Impact

- **Who notices:** clinic staff using the Owners screen. Nothing changes for pet owners
  using the chatbot.
- **Data:** no owner data is changed or lost.
- **Delivery:** one release; the screen and the system behind it change together.
- **Still to confirm:** several of the choices above (the page sizes, remembering the page
  in the link, opening the last page for an old link) are recommendations awaiting
  confirmation; see `/Q&A.md`, rows 5–18.

Technical decisions are in `design.md`.
