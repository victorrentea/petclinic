## Why

Today the owners list shows **every** owner at once, in one long page. That works while we
have a few dozen owners. The business is aiming at **100.000 owners within a year** — at that
size the same list becomes unusable: it takes a long time to appear, you scroll forever, and
the only way to find someone is to search for them by name.

Issue [#25](https://github.com/victorrentea/petclinic/issues/25) asks for the list to be split
into pages and to be sortable. This document describes what the person at the front desk will
see and be able to do, so you can confirm we understood the request correctly.

## What Changes

**The list arrives one screen at a time.** The front desk sees one screenful of results, with
"next / previous" buttons and a selector for how many rows to show at a time: **5, 10 or 20**.
The default is 10. Underneath the list it always says where you are and what the total is —
for example "1 – 10 of 28".

**The list can be ordered by Name and by City.** One click on a column heading sorts it
ascending, another click descending. The name is now shown as **"Potter, Harry"** — family
name first — because at hundreds of thousands of rows the eye looks for the family name, the
way a phone book is organised.

**The Address and Telephone columns stay read-only — you cannot sort by them.** This is not an
oversight, it is a decision: an address starts with the house number, so sorting it would give
"14 Kensington, 221B Baker, 26 Rue, 4 Privet" — an order that means nothing. Phone numbers
have different lengths, start with a country prefix, and one of them is empty; ordering them
tells nobody anything. Here we deliberately depart from the literal wording of the ticket
("sortable by any column") and we need you to confirm it.

**The "Pets" column leaves the list.** To bring one screenful out of 100.000 rows quickly, the
list carries only the owner's own details. How many pets an owner has, and their names, remain
exactly where they are today — on the owner's detail page, one click away on the row. If the
front desk genuinely needs "how many pets" in the list itself, we can add it later, but that is
a separate request with its own cost.

**The link remembers where you were.** The page you are on, the ordering and the search stay in
the browser address: you can refresh, use the back button, or send the link to a colleague —
everyone sees exactly the same screen.

**Nobody can accidentally ask for the whole database.** Even if someone tries to request more
than 20 rows at a time, the system refuses. This is the protection that keeps the application
standing at 100.000 owners.

**What does NOT change:**
- **Search stays exactly as it is today**: it matches the beginning of the family name and it
  is case-sensitive. "Pot" finds "Potter"; "potter" with a small p finds nothing, and "otter"
  finds nothing. We know this will annoy people at 100.000 owners — improving it is a separate
  piece of work with its own cost, and we are not slipping it in here.
- The owner detail page, the pets and the visits are untouched.
- The rest of the application (vets, specialties, visits) is unaffected.

## Capabilities

### New Capabilities
- `owners-listing`: listing owners — searching by name, how many owners are shown at a time,
  which columns the list can be ordered by, and what appears on each row.

### Modified Capabilities
<!-- none: this is the first capability described in openspec/specs/ -->

## Impact

**For the front desk (daily users):** the screen looks different — pages instead of an endless
list, the name written "Family, First", no Pets column, and the ability to order by Name and
City. No information is lost from the system; what changes is how much you see at once and
where you go for the rest.

**For the business:** the application stays usable at the 100.000-owner target, instead of
getting progressively slower until it is unusable.

**What we deliberately postponed, as separate tickets** (each has its own cost — we are not
hiding them):
1. Search that ignores capital letters and also matches the middle of a name.
2. Sorting by telephone — only possible once we standardise the number format.
3. Bringing the pet count back into the list.

**The technical effort** — the code, database and test changes — is described in `design.md`
and `tasks.md`, for the discussion with the engineering team.

## What we are asking you to confirm in the meeting

1. Does 5 / 10 / 20 rows at a time, with 10 by default, match how the front desk works?
2. Is it acceptable that the list can be ordered **only** by Name and City, not by any column?
3. Is it acceptable that the pet count lives on the detail page rather than in the list?
4. Is "Potter, Harry" the right way to show the name in the list?
5. Do you confirm that improving the search belongs to a separate ticket, not this one?
