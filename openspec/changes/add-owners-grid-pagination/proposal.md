# Proposal: Owners list in pages, with sorting

## Why

Today the Owners screen shows every owner at once. That works for the 27 owners we have now, but we
expect about **100,000 owners within a year**. Showing all of them at once would make the screen slow
and impossible to scroll through.

## What Changes

- **The list is shown a few owners at a time**, like the pages of a phone book. Staff choose
  **5, 10 or 20 owners per page** and move between pages with arrows. Below the list it says, for
  example, "11 – 20 of 27".
- **Staff can choose the order** by clicking a column title:
  - **Name**, by surname first: Holmes comes before Potter, and Beatrix Potter before Harry Potter.
  - **City**: all the London owners end up next to each other.
  - Click again to reverse the order (Z to A).
- **Names with accents are where people expect them**: Śliwiński is listed among the S names,
  not at the very end of the list.
- **Searching by surname stays exactly as it is today**: it matches the start of the surname, and
  capital letters matter ("Pot" finds Potter, "pot" does not). A new search always starts from page 1.
- **The screen remembers where you were**: if you open an owner and come back, refresh the page or
  send the link to a colleague, you see the same page in the same order.
- **"No owners found" means what it says**: it only appears when nothing matched, never when the
  system had a problem loading the list.

## What is NOT included

- Ordering by address, phone or pets. These are written in too many different ways (for example
  "+44…", "(0044)…" and "0044…") for any order to be useful.
- Searching that ignores capital letters or accents ("potter" finding Potter).
- Pages on the other lists (vets, visits).
- Making each owner's details lighter to load.

## Who is affected

- **Clinic staff on the Owners screen**: they now see the first 10 owners in alphabetical order and
  use the arrows or the search to reach the others.
- **Pet owners using the chatbot**: nothing changes for them.

## Capabilities

### New Capabilities
- `owner-search`: finding owners in the clinic's list, by searching on surname, browsing page by page
  and choosing the order.

### Modified Capabilities
<!-- none -->
