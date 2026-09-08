## Why

Issue #25 asks for a sortable, paginated Owners grid. Today the Owners list loads the entire
table in one go, with every owner's full pet and visit history attached. That works fine on
our 28-row dev database, but the business target is 100,000 owners in production — at that
size, loading "everything, every time" is not a performance nuisance, it is an outage waiting
to happen. This must be fixed before we grow the data, not after.

## What Changes

- **BREAKING**: the Owners list no longer returns "all owners" in one response — it returns
  one page at a time. This only affects our own frontend, which is updated in the same
  change; nothing else in or outside the company talks to this API today.
- The Owners screen gets a page-size choice of **5 / 10 / 20** rows (default 10), and users can
  page forward/back through the results.
- The **Name** and **City** columns become clickable to sort ascending/descending. **Address**
  and **Telephone** stay plain, non-sortable headers (data quality reasons — see design.md).
- The Name column now displays **"Last name, First name"** instead of "First name, Last
  name", so what's sorted matches what's shown.
- Sorting by name will correctly place accented/foreign names (e.g. Polish "Śliwiński") in
  their proper alphabetical spot instead of dumping them at the end of the list.
- The current page, page size, and sort choice are reflected in the browser's address bar, so
  a specific view of the list can be bookmarked, shared, or revisited with Back/Forward.
- An old, unused leftover file in the frontend is deleted as cleanup — no visible effect.
- One existing automated test that checked the old "returns everything" behavior is updated
  to match the new paged behavior.

## Capabilities

### New Capabilities
- `owners/pagination`: how the Owners list behaves — paging, sorting, and what the list
  screen shows and remembers (via the URL) for the user.

### Modified Capabilities
(none — no existing `openspec/specs/` capabilities are defined yet for this project)

## Impact

- **Owners list screen**: paging, sorting, and display order change as described above.
- **Owners API**: the shape of the data it returns changes (breaking), affecting only our
  own frontend.
- **Database**: a schema migration is needed to make sorting correct and fast at scale; this
  goes through our normal database-change review.
- **Tests**: automated tests are extended to cover paging and sorting, and one existing test
  is updated for the new response shape.

Technical rationale, alternatives considered, and implementation details live in `design.md`.
