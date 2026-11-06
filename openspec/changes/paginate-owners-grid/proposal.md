# Proposal

## Why

Today the Owners screen loads every owner at once. It has no pages and no sorting (issue #25).

The clinic expects 100,000 owners by November 2027. That is far too many to show in one long list.

Once owners are split into pages, the browser's find-on-page only sees the page you are on. So the last-name search has to do the real work. It must find an owner even when someone types `potter` or `Mures`, without capitals or accents. Otherwise staff cannot find owners.

## What Changes

- The Owners screen shows one page of owners at a time, never all of them.
- Staff can choose pages of 5, 10 or 20 owners. The default is 10.
- Staff can sort by Name or City, from A to Z or from Z to A. The default is Name, A to Z.
- Names sort like a dictionary. `Ștefan` sits with the S names, not after Z.
- Only Name and City can be sorted. This is a deliberate difference from issue #25, which says "any column". The reasons:
  - Addresses are free text and phone numbers come in mixed formats. Sorting them gives a meaningless order.
  - An owner can have several pets, so there is no single value to sort Pets by.
- The last-name search ignores capitals and accents. Typing `potter` or `Mures` now finds the owner.
- The search still matches only the start of the whole last name. So `Garcia` does not find `Martín García Lorca`.
- The screen remembers where you are. The page, the order and the search survive the Back button, a refresh and a shared link.

## Capabilities

### New Capabilities

- `owner-list`: staff browse owners one page at a time, in the order they choose.
- `owner-search`: staff find owners by typing the beginning of the last name.

### Modified Capabilities

None yet. There are no existing capabilities on record.

## Impact

- **Who is affected**: everyone on staff who uses the Owners screen. Chatbot users see no change.
- **Size to plan for**: 100,000 owners by November 2027.
- **Not included**: sorting by Address, Telephone or Pets, and searching inside a last name.
- **Release**: the new screen and the changes behind it go live together.
