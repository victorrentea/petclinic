# Proposal

## Why

The Owners screen shows every matching owner at once. With around 100,000 owners expected within a year, users need a faster, more manageable way to browse and find people.

## What Changes

- Show owners in pages of 5, 10, or 20 rows, starting with 10.
- Let users move between pages and see the current range and total number of matches.
- Allow ascending or descending sorting by Name and City. Start with Name in alphabetical order, comparing last names first.
- Keep the existing last-name search: match the beginning of a last name, with uppercase and lowercase treated differently.
- Return to the first page when the search, sorting, or page size changes. Keep the selected sorting when searching.
- Always show the results for the user's latest search or chosen page.
- Preserve the applied page, page size, sorting, and search in the URL so refresh, shared links, and browser history restore the same view.
- Clearly distinguish no matching owners from a loading failure.
- Keep owner details, pets, visit booking, and Add Owner available as before.

## Screen Sketch

Illustrative layout for discussion, not a final design. Names and totals below are examples.

### Regular screen

```text
+--------------------------------------------------------------------------+
| Owners                                                                   |
|                                                                          |
| Last name: [ ________________________ ]  [ Find Owner ]                   |
|                                                                          |
| Name ^             | Address           | City <>   | Telephone | Pets     |
|--------------------+-------------------+-----------+-----------+----------|
| Alice Adams        | ...               | London    | ...       | ...      |
| Bob Brown          | ...               | Bristol   | ...       | ...      |
| ...                                                                      |
|                                                                          |
| Rows per page: [10 v]    1-10 of 26       [|<] [<] [>] [>|]                |
|                                                                          |
| [ Add Owner ]                                                            |
+--------------------------------------------------------------------------+
```

### Small screen

```text
+------------------------------------+
| Owners                             |
|                                    |
| Last name:                         |
| [ ______________________________ ] |
| [ Find Owner ]                     |
|                                    |
| Name ^           | Address    ...  |
|------------------+-----------------|
| Alice Adams      | ...             |
| Bob Brown        | ...             |
| ...                                |
| <--- scroll table sideways --->    |
|                                    |
| Rows per page: [10 v]              |
| 1-10 of 26                         |
|             [|<] [<] [>] [>|]      |
|                                    |
| [ Add Owner ]                      |
+------------------------------------+
```

- Click Name or City to change the sorting direction; the active column shows an up or down arrow.
- Rows per page offers 5, 10, and 20.
- The four navigation buttons go to the first, previous, next, and last page. Unavailable actions are disabled.
- On a small screen, all columns remain available by scrolling the table sideways. Pagination stays below the table and does not require sideways scrolling.

## Capabilities

### New Capabilities

- `owner-list`: Browse owners a page at a time, search by last name, and sort by Name or City.

### Modified Capabilities

None.

## Impact

- Clinic users will browse a smaller list instead of seeing every owner at once.
- **BREAKING**: Other software that reads the full owners list must be updated to read it a page at a time. Release those updates together with the screen changes.
- Sorting is limited to Name and City, narrowing the original "any column" request in #25. Record this decision and correct the earlier claim that the work was already complete.
- Owner details, editing, visit booking, and chatbot behavior are unchanged.
- Out of scope: sorting by Address, Telephone, or Pets; changing how search matches names; and unrelated diagram corrections.
- Testing response times with 100,000 owners or many simultaneous users is deferred until budget is available. This change does not claim to prove performance at that scale.
- Basis: [design Q&A](https://github.com/victorrentea/petclinic/blob/db27oct/Q%26A.md). Q1-Q4 and the updated Q11 are confirmed decisions; the other Q5-Q15 answers remain working assumptions for review before implementation.
