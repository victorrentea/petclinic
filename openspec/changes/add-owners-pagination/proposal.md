# Add pagination and sorting to the Owners grid

Implements [gh #25](https://github.com/victorrentea/petclinic/issues/25).

## Why

The Owners screen shows every owner in the clinic at once, in a single long list.

That works today because there are only 28 owners in our test data. We are planning for **about
10,000 owners**. At that size the screen would try to load all ten thousand of them — plus every
pet and every visit belonging to them — every single time someone opens it. It would be slow,
then unusable, and it would slow the whole system down for everyone else while it happened.

Issue #25 asks for the two things that fix this from the user's point of view: show the list one
page at a time, and let people sort it.

There is a second reason to do it now. Once people can sort the list, the *order* of the rows
becomes something they look at and trust. Today that order has two defects nobody has noticed,
because with 28 English names they are invisible:

- Names are sorted by their internal computer representation rather than alphabetically. Names
  starting with a lowercase letter — *de Vries*, *van Gogh* — end up after *all* other names, and
  any name with an accent — *Szabó*, *Ștefănescu* — ends up dead last, after those. With 10,000
  Dutch, Hungarian and Romanian names this would be immediately visible and would look plainly
  broken.
- When two owners share a value — we have seven owners in London, and two Potters — the database
  is free to order them differently on each request. Paging through the list, an owner can appear
  on two consecutive pages while another is skipped entirely. Nobody would ever get a reliable
  count by scrolling.

This change fixes both, because #25 is the first feature that makes them matter.

## What Changes

**What people will see**

- The Owners list is shown one page at a time, with a pager to move between pages.
- The user can choose 5, 10 or 20 rows per page, as the issue asks.
- The Name and City columns can be sorted by clicking their headers.
- The Name column is shown as *last name first* — *Potter, Harry* — matching the search box on that
  same screen, which already searches by last name.
- Anything that reshapes the list — searching by last name, sorting by a different column,
  reversing the sort, or changing the rows per page — takes the user back to the first page.
  Only the pager itself moves you between pages. Otherwise the user would be left on page 4 of a
  search that now has three rows, or looking at "page 4" of a list they have just re-sorted, which
  no longer means anything to them.
- The screen keeps its current look. Nothing else on it changes.
- The page you are on is part of the address in the browser bar, so bookmarking, refreshing and the
  Back button all behave as expected, and a page of results can be shared with a colleague by
  sending a link.

**What will not be sortable, and why**

The issue asks for "sortable by any column". We propose sorting **Name and City only**, and
deliberately *not* Address, Telephone or Pets:

- **Address** is free text that mostly begins with a house number. Sorted, it reads
  *14…, 221B…, 26…, 27…, 30…, 4…, 62…* — the "4" lands after the "30". That is technically correct
  for text, and it looks like a bug to every person who sees it. A third of our addresses have no
  number at all — *The Burrow*, *Diagon Alley* — so they scatter unpredictably.
- **Telephone** has no consistent format — we hold numbers of different lengths, some with country
  prefixes and some without, and one owner has none at all. Sorting them puts them in an order no
  human recognises as an order.
- **Pets** is a list, not a single value. There is no agreed meaning to "sort by pets" — by how many,
  by the first pet's name alphabetically, by the newest? Each would surprise someone.

A sort that produces nonsense is read as a broken feature, not as a limitation, so we would rather
not offer it. **This is a conscious departure from the wording of the issue and needs the product
owner's agreement.** If any of these three is genuinely needed, we should decide *what* the order
should mean before building it.

**Alphabetical order across our three markets**

We sell into the Netherlands first, then Hungary, then Romania. Those three countries do not
alphabetise names identically, and a list can only be stored in one order:

- **Dutch order and neutral international order are exactly the same.** We checked. So the
  Netherlands is served perfectly by the neutral order, and that is what we propose to use.
- **Hungarian differs.** Hungarians treat "cs", "sz", "zs" as single letters that come *after* the
  plain letter. A Hungarian expects *Cukor, Czakó, Csaba*; the neutral order gives *Csaba, Cukor,
  Czakó*. Real, and visible to a Hungarian user in any list of names.
- **Romanian differs.** A Romanian expects *Szabó* then *Ștefănescu*, and *Tudor* then *Țucă*; the
  neutral order interleaves them with the plain S and T names.

We propose to ship the neutral order, which is exactly right for the Netherlands and mildly wrong
for Hungary and Romania. Making the list re-sort itself per country is possible but is a
significantly larger piece of work, and it only pays off once we have enough Hungarian and
Romanian users to notice. **We would like agreement to accept that, and to revisit it when Hungary
becomes a real market.**

**How we file Dutch names — a question we cannot answer ourselves**

In the Netherlands, *van*, *de*, *van der* are conventionally not used for filing: Vincent van Gogh
is looked up under **G**, not under **V**. Every computer ordering we have — neutral, Dutch,
Hungarian, Romanian alike — files him under **V**, and *de Vries* under **D**.

We cannot fix that by changing a setting; it needs the name prefix to be stored as its own piece of
information, the way Dutch systems normally do. That is a change to how we record every owner, not
just to how we sort them, so it is out of scope here — but with the Netherlands as our first market
it will be asked for, and it is much cheaper to decide before we have 10,000 owners on file than
after. **We need a decision on whether to plan this now.**

**What changes behind the scenes**

- The clinic's own web app and its automated tests are the only things that read this list, so we
  can change how the list is delivered without affecting anyone outside the team. If we ever expose
  it more widely, this becomes far more expensive — which is an argument for doing it now.
- The database gets a one-off upgrade so it sorts names alphabetically the way a person expects,
  plus the equivalent of an index in a book so it can find and order pages quickly at 10,000
  owners instead of reading the whole table each time.
- Loading one page of owners currently costs the system dozens of separate database round-trips.
  This change brings it down to a handful.

## Capabilities

### New Capabilities
- `owners-list-api`: how the system serves one page of owners — page size limits, which columns can
  be sorted, and the guarantee that paging through the list shows every owner exactly once.
- `owners-grid-ui`: the Owners screen itself — sortable headers, pager, rows-per-page choice,
  interaction with the search box, and the "no owners found" message.

### Modified Capabilities
None — these are the first two specs written for this project.

## Impact

**For users of the clinic system**
- The Owners screen behaves differently: paged instead of one long list. This is the intended,
  visible change.
- Sorted results will appear in a different (correct) order than before for names with lowercase
  prefixes or diacritics.

**For the team**
- Touches the Owners screen, the service behind it, the database, and the automated tests. Roughly
  a day or two of work, most of it verification.
- The other five list screens (Vets, Pets, Visits, Specialties, PetTypes) have exactly the same
  problem waiting for them. We are **not** fixing them here — that is a separate decision about
  scope and timing, and we will raise it as its own issue.

**Risk to be aware of**
- One technical risk cannot be settled at our current data size: the fix that makes names sort
  correctly may slow down the existing last-name search, and with 28 owners the effect is invisible.
  We will test against a generated 10,000-owner dataset before calling this done. If it turns out
  we cannot have both, we will come back with the trade-off rather than ship a quiet regression.

**Decisions needed from the product owner**
1. Agreement that Name and City are the only sortable columns (see above).✅
2. Confirmation that 5 / 10 / 20 rows per page are the right choices, with 10 as the default.✅
3. Agreement to ship one neutral alphabetical order — exactly right for the Netherlands, mildly
   wrong for Hungary and Romania — and to revisit per-country ordering when Hungary grows.✅
4. Whether filing Dutch names under the main surname (*van Gogh* under **G**) should be planned
   now. It is out of scope for this change either way, but the answer decides whether we start
   recording name prefixes separately before the owner list grows.✅
