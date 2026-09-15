## Purpose

How the clinic lists its owners: a paged, sorted view served from the database so that the
list stays usable and cheap at ~100.000 owners, with a stable page contract and a single
"Last, First" name rendering across the UI.

## ADDED Requirements

### Requirement: Owner list is always paged
`GET /api/owners` SHALL return one page of owners with the fields `content`, `totalElements`,
`totalPages`, `number` (0-based page index) and `size`. It SHALL never return an unpaged array,
whatever the query parameters.

#### Scenario: Default request
- **WHEN** a client calls `GET /api/owners` with no query parameters
- **THEN** the response is page 0 of size 10, sorted by name ascending, with `totalElements`
  equal to the exact number of owners in the clinic

#### Scenario: Explicit page
- **WHEN** a client calls `GET /api/owners?page=2&size=10` and the clinic holds 28 owners
- **THEN** `content` holds owners 21–28 of the sort order, `number` is 2, `totalPages` is 3,
  `totalElements` is 28

#### Scenario: Page past the end
- **WHEN** a client requests a page index at or beyond `totalPages`
- **THEN** the response is 200 with an empty `content` and the true `totalElements`

### Requirement: Page size is one of 5, 10 or 20
The `size` parameter SHALL accept exactly the values 5, 10 and 20 and default to 10. Any other
value SHALL be rejected with 400 and a Problem Detail body naming the parameter.

#### Scenario: Allowed size
- **WHEN** a client requests `size=20`
- **THEN** the page holds at most 20 owners and `size` is 20

#### Scenario: Oversized page rejected
- **WHEN** a client requests `size=100000` (or 0, 7, -1)
- **THEN** the response is 400 and no owners are loaded

### Requirement: List item shape
Each element of `content` SHALL carry the owner's `id`, `firstName`, `lastName`, `address`,
`city`, `telephone` and `petNames` (the owner's pet names, sorted by name). It SHALL NOT carry
visits. `GET /api/owners/{id}` is unchanged and keeps returning pets with their visits.

#### Scenario: Owner with pets
- **WHEN** an owner on the page has pets "Leo" and "Basil"
- **THEN** the item's `petNames` is `["Basil", "Leo"]`

#### Scenario: Owner without pets
- **WHEN** an owner on the page has no pets
- **THEN** the item's `petNames` is `[]`

### Requirement: Sortable by Name or City only
The `sort` parameter SHALL accept `NAME` (default) and `CITY`; `dir` SHALL accept `asc`
(default) and `desc`. `NAME` SHALL order by last name, then first name, then id. `CITY` SHALL
order by city, then id. Any other `sort` or `dir` value SHALL be rejected with 400. Address and
telephone are not sortable.

#### Scenario: Name ascending
- **WHEN** the clinic holds "Harry Potter", "Beatrix Potter" and "Betty Davis" and the client
  requests `sort=NAME&dir=asc`
- **THEN** the order is Davis Betty, Potter Beatrix, Potter Harry

#### Scenario: Name descending
- **WHEN** the same clinic is requested with `sort=NAME&dir=desc`
- **THEN** the order is Potter Harry, Potter Beatrix, Davis Betty

#### Scenario: City with a tiebreak
- **WHEN** two owners share the city "Madison" and the client requests `sort=CITY`
- **THEN** they appear adjacent, ordered by id, and the same order is returned on every call

#### Scenario: Unknown sort field
- **WHEN** a client requests `sort=address` or `sort=pets.visits.description`
- **THEN** the response is 400 and no query is executed against unsortable columns

### Requirement: Name ordering follows the alphabet, not byte order
Sorting by `NAME` SHALL place names with diacritics next to their base letter (e.g. "Śliwiński"
directly after the "S" names, never after "Z"), and the database SHALL be able to serve this
order from an index rather than sorting the whole table.

#### Scenario: Diacritic in last name
- **WHEN** the clinic holds "Smith", "Śliwiński" and "Taylor" and the client sorts by name
  ascending
- **THEN** the order is Śliwiński, Smith, Taylor — ICU compares base letters position by
  position ("Sliwinski" vs "Smith": second letter 'l' < 'm'), so the diacritic sorts before
  Smith, not after it

### Requirement: Paging is stable across pages
Walking every page of a given `sort`/`dir`/`size` SHALL yield each owner exactly once: no
duplicates, no gaps, even when many owners share the sort key.

#### Scenario: Union of pages equals the clinic
- **WHEN** a client fetches pages 0..totalPages-1 with `size=5`
- **THEN** the union of `content` has exactly `totalElements` distinct ids

### Requirement: Last-name prefix filter is preserved
The `lastName` parameter SHALL keep its case-sensitive prefix semantics and SHALL combine with
paging and sorting; `totalElements` SHALL count only the matching owners.

#### Scenario: Filter with paging
- **WHEN** a client requests `lastName=Pot&size=5`
- **THEN** `content` holds only owners whose last name starts with "Pot" and `totalElements`
  equals their count

#### Scenario: Case-sensitive
- **WHEN** a client requests `lastName=potter`
- **THEN** `content` is empty and `totalElements` is 0

### Requirement: Owners grid in the UI
The Owners page SHALL show one page of owners in a table with sortable Name and City headers,
a paginator offering 5, 10 and 20 rows per page (default 10), and the last-name search. The
Address, Telephone and Pets columns SHALL NOT be sortable.

#### Scenario: Sort by clicking a header
- **WHEN** the user clicks the Name header twice
- **THEN** the grid reloads sorted by name descending, showing the sort direction indicator

#### Scenario: Change page size
- **WHEN** the user picks 20 rows per page on a 28-owner clinic
- **THEN** the grid shows 20 rows and the paginator reports 2 pages

#### Scenario: No results
- **WHEN** a search returns `totalElements` 0
- **THEN** the page shows "No owners with LastName starting with "<search>"" and no table; the
  message SHALL NOT flash while a non-empty page is loading

### Requirement: Grid state lives in the URL
The current `page`, `size`, `sort`, `dir` and `lastName` SHALL be reflected in the Owners page
URL, and opening such a URL SHALL restore that exact view. Changing them SHALL NOT add
browser-history entries.

#### Scenario: Deep link
- **WHEN** the user opens `/owners?page=1&size=5&sort=CITY&dir=desc`
- **THEN** the grid shows page 2 of 5 rows sorted by city descending, and the paginator and
  headers reflect it

#### Scenario: Refresh keeps the place
- **WHEN** the user is on page 3 and reloads the browser
- **THEN** the grid returns to page 3 with the same sort

### Requirement: A new search resets the page
Submitting a new last-name search SHALL return to page 0 and SHALL keep the current sort and
page size.

#### Scenario: Search from a deep page
- **WHEN** the user is on page 2 sorted by city descending and searches for "Pot"
- **THEN** the grid shows page 0 of the filtered result, still sorted by city descending

### Requirement: Responses are applied in request order
When the user changes sort, page or search faster than the server answers, the grid SHALL
render only the response to the latest request; a stale response SHALL NOT overwrite it.

#### Scenario: Sort then page quickly
- **WHEN** the user clicks a sort header and then the next-page button before the first
  response arrives
- **THEN** the grid shows the page-2 result of the new sort and nothing else

### Requirement: Grid load failures are visible
When loading a page fails, the UI SHALL show the error (via the application's existing error
toast) and SHALL NOT present the failure as an empty owner list.

#### Scenario: Server error
- **WHEN** `GET /api/owners` responds 500
- **THEN** an error toast appears and the "No owners" message is not shown

### Requirement: Owner names render as "Last, First" everywhere
Every place the UI shows an owner's name (owners grid, owner detail, pet add/edit, visit
add/edit) SHALL render it as `<lastName>, <firstName>`. If one part is missing, the other
SHALL be shown alone with no comma.

#### Scenario: Full name
- **WHEN** an owner is Harry Potter
- **THEN** the UI shows "Potter, Harry"

#### Scenario: Missing part
- **WHEN** an owner has last name "Potter" and no first name
- **THEN** the UI shows "Potter"

## Gherkin sketch for `petclinic-test/src/owners-grid.feature`

Runs against the seeded clinic, read-only. Steps marked *(existing)* are already bound in
`owner-search.feature.glue.ts`; the four others are new. Names use the "Last, First" form and
`;` as the list separator, which is what the glue switches to with this change.

```gherkin
Feature: Owners grid — sort by a column, browse by pages
  As a clinic user
  I want the owners list sorted by the column I pick and split into pages
  So that a clinic with 100.000 owners stays readable

  Background:
    Given the clinic has these owners            # existing
      | Darling, George  |
      | Darling, Wendy   |
      | Dickens, Charles |
      | Dolittle, John   |

  Scenario Outline: Sorting by Name uses last name, then first name; by City, then id
    When I open the owners page                   # existing
    And I search owners for "D"                   # existing
    And I sort owners by "<column>" <direction>   # new
    Then the owners are listed in this order: "<owners>"   # new, order-sensitive

    Examples:
      | column | direction  | owners                                                              |
      | Name   | ascending  | Darling, George; Darling, Wendy; Dickens, Charles; Dolittle, John   |
      | Name   | descending | Dolittle, John; Dickens, Charles; Darling, Wendy; Darling, George   |
      | City   | ascending  | Dickens, Charles; Darling, George; Darling, Wendy; Dolittle, John   |

  Scenario Outline: A page holds only its slice of the sorted clinic
    When I open the owners page                   # existing
    And I show <size> owners per page             # new
    And I go to page <page>                       # new
    Then exactly these owners are listed: "<owners>"   # existing, order-insensitive

    Examples:
      | size | page | owners                                                                                             |
      | 5    | 5    | Riddle, Tom; Scamander, Newt; Schroedinger, Erwin; Silver, Long; Śliwiński, Salazar                |
      | 5    | 6    | Tremaine, Lady; Weasley, Ronald; Wensleydale, Wallace                                              |
      | 20   | 2    | Riddle, Tom; Scamander, Newt; Schroedinger, Erwin; Silver, Long; Śliwiński, Salazar; Tremaine, Lady; Weasley, Ronald; Wensleydale, Wallace |

  Scenario: Walking every page lists each owner exactly once
    When I open the owners page                   # existing
    And I show 5 owners per page                  # new
    Then every owner in the clinic is listed      # existing — re-bound to walk the pages
```

What each row pins:
- Name ascending: the two Darlings prove the first-name tiebreak; descending proves it flips.
- City ascending: Higham < London < Puddleby, and the two London rows keep id order.
- Page 5 of 5: "Śliwiński" lands beside "Silver" — under the default collation it would be
  alone at the end, on page 6. Page 6 of 5: 28 owners = 5 full pages + 3.
- Size 20, page 2: the same 8 tail owners, so switching size does not lose or duplicate rows.
