## Purpose

Browsing the clinic's owner list at scale: server-side pagination and sorting, how search interacts
with paging, view state that survives Back and can be shared as a link, validation of the
parameters that carry that state, and the empty and error states of the grid.

## ADDED Requirements

### Requirement: Server-side pagination of the owner list

The system SHALL paginate the owner list on the server. It SHALL NOT transfer the full owner
collection to the client for client-side slicing. The list endpoint SHALL accept a page index, a
page size and a sort instruction, and SHALL return the requested slice together with the total
number of matching owners.

#### Scenario: A page is requested
- **WHEN** a client requests the owner list with page index 2 and page size 5
- **THEN** the response contains at most 5 owners, being the 11th through 15th of the ordered result
- **AND** the response reports the total number of matching owners, the current page index and the page size

#### Scenario: Payload is bounded regardless of database size
- **WHEN** the database holds 10,000 owners and a client requests the list with no parameters
- **THEN** the response contains 10 owners, not 10,000

#### Scenario: Total count reflects the filter, not the table
- **WHEN** a client requests the list filtered to last names starting with "Potter"
- **THEN** the reported total is the number of matching owners, not the total number of owners

### Requirement: Sortable columns are restricted to those where ordering is meaningful

The grid SHALL offer sorting on **Name**, **City** and **Pets** only. **Address** and **Telephone**
SHALL be displayed as non-sortable columns.

Name SHALL order by last name, then first name. Pets SHALL order by the **number** of pets the
owner has, not by pet name.

#### Scenario: Sorting by name
- **WHEN** the user sorts by Name ascending
- **THEN** owners are ordered by last name, and owners sharing a last name are ordered by first name
- **AND** an owner named "Beatrix Potter" precedes an owner named "Harry Potter"

#### Scenario: Sorting by pets ascending
- **WHEN** the user sorts by Pets ascending
- **THEN** owners with no pets appear first, followed by owners with one pet, then two, and so on

#### Scenario: Address and Telephone are not sortable
- **WHEN** the user views the grid
- **THEN** the Address and Telephone column headers offer no sort control

### Requirement: The default view is defined and populated

On first load, with no parameters supplied, the grid SHALL display the first page of **all** owners,
ordered by **Name ascending**, at a page size of **10**. The grid SHALL NOT require a search before
showing results.

#### Scenario: Opening the owners screen
- **WHEN** the user navigates to the owners screen with no parameters
- **THEN** the first 10 owners are shown, ordered by last name then first name
- **AND** the pager reports page 1 and the total number of owners

### Requirement: Ordering is deterministic across pages

Every ordering SHALL be total. When the chosen sort column produces ties, the system SHALL break
them by last name, then first name, then a stable unique identifier, so that paging through an
unchanged result set visits every owner exactly once.

#### Scenario: Paging a low-cardinality sort
- **WHEN** owners are sorted by Pets ascending and the user pages through the entire result set
- **THEN** no owner appears on two different pages
- **AND** no owner is skipped

#### Scenario: Repeating the same request
- **WHEN** the same page, size and sort are requested twice against unchanged data
- **THEN** both responses contain the same owners in the same order

#### Scenario: Ties read sensibly to the user
- **WHEN** owners are sorted by City and several owners share the city "London"
- **THEN** those owners appear ordered by name within that city

### Requirement: Changing sort, page size or search returns to the first page

Only the pager's own navigation controls SHALL change which page is displayed. Changing the sort
column, the sort direction, the page size, or the search term SHALL return the user to page 1.

#### Scenario: Changing the sort while deep in the list
- **WHEN** the user is on page 3 and clicks the City column header
- **THEN** the grid displays page 1 of the city-ordered result

#### Scenario: Changing the page size while deep in the list
- **WHEN** the user is on page 3 at size 10 and selects size 20
- **THEN** the grid displays page 1 at size 20

#### Scenario: Searching while deep in the list
- **WHEN** the user is on page 3 and searches for last names starting with "Potter"
- **THEN** the grid displays page 1 of the Potter results

### Requirement: Search composes with sorting and paging

The existing search — matching the **start** of an owner's last name — SHALL filter the paginated
result. The active sort and the selected page size SHALL survive a search. Search semantics SHALL
remain unchanged by this capability.

#### Scenario: Sort survives a search
- **WHEN** the user has sorted by City and then searches for "Potter"
- **THEN** the Potter results are shown ordered by City

#### Scenario: Page size survives a search
- **WHEN** the user has selected a page size of 20 and then searches
- **THEN** the results are paged at size 20

### Requirement: View state is addressable and shareable

The page index, page size, sort instruction and search term SHALL be represented in the page URL.
Navigating to such a URL directly SHALL reproduce the corresponding view. Returning to the grid via
browser Back, or reloading the page, SHALL restore the view the user was on rather than resetting
to the default.

#### Scenario: Returning from an owner's details
- **WHEN** the user is on page 3 sorted by City, opens an owner, and presses Back
- **THEN** the grid is shown on page 3, still sorted by City

#### Scenario: Reloading the page
- **WHEN** the user reloads the browser on a sorted, paged view
- **THEN** the same view is rendered

#### Scenario: Opening a shared link
- **WHEN** a user opens a link carrying page index, page size and sort supplied by a colleague
- **THEN** that exact view is rendered

### Requirement: View-state parameters are validated

Because view-state parameters are user-supplied, the system SHALL validate them.

- A page index beyond the end of the result set SHALL yield an **empty page**, not an error.
- A page size outside the supported set (5, 10, 20) SHALL be **clamped** into that set. The system
  SHALL NOT return an unbounded number of rows in response to a client-supplied size.
- A sort instruction naming a column that is not sortable SHALL be **rejected with 400 Bad
  Request**. It SHALL NOT be silently ignored, and the supplied name SHALL NOT reach the query
  unvalidated.

#### Scenario: Page index past the end
- **WHEN** a client requests page 500 of a 3-page result
- **THEN** the response is an empty page reporting the true total
- **AND** the grid tells the user the page is empty and offers a way back to page 1

#### Scenario: Oversized page size
- **WHEN** a client requests a page size of 1000
- **THEN** at most 20 owners are returned

#### Scenario: Unsupported page size
- **WHEN** a client requests a page size of 7
- **THEN** the request succeeds using a supported page size

#### Scenario: Sort on a non-sortable column
- **WHEN** a client requests sorting by telephone
- **THEN** the response is 400 Bad Request

#### Scenario: Sort on an unknown name
- **WHEN** a client requests sorting by an arbitrary unrecognised name
- **THEN** the response is 400 Bad Request

### Requirement: Names are ordered by locale rules, not byte values

Alphabetical ordering of owner names and cities SHALL follow Romanian locale collation. Letters
carrying diacritics SHALL sort adjacent to their base letter, and ordering SHALL be
case-insensitive with respect to position. Ordering SHALL NOT depend on which database instance
serves the request.

#### Scenario: Diacritics sort in their alphabetical position
- **WHEN** owners named "Stan", "Ștefan" and "Tudor" are sorted by Name ascending
- **THEN** they appear in the order "Stan", "Ștefan", "Tudor"

#### Scenario: Capitalisation does not exile a name
- **WHEN** an owner's last name was entered as "popescu" in lowercase
- **THEN** that owner sorts among the names beginning with P, not after Z

### Requirement: The Pets column shows the count alongside the pet names

The Pets cell SHALL display the number of pets in addition to their names, so that the effect of
sorting by Pets is visible on screen. An owner with no pets SHALL render an explicit zero rather
than an empty cell.

#### Scenario: Owner with pets
- **WHEN** an owner has two pets named "Dinah" and "Cheshire"
- **THEN** the Pets cell shows the count 2 together with both names

#### Scenario: Owner with no pets
- **WHEN** an owner has no pets
- **THEN** the Pets cell shows 0

### Requirement: Empty and failed results are distinguishable

The grid SHALL distinguish three states that are currently conflated:

1. **A search matched nothing** — the grid SHALL say so, naming the search term, and SHALL retain
   the term in the search field so it can be corrected.
2. **There are no owners at all** — the grid SHALL say so.
3. **The request failed** — the grid SHALL present an error distinct from both empty states.

A failed request SHALL NEVER be presented as an empty result.

#### Scenario: Search matches nothing
- **WHEN** the user searches for a last-name prefix that matches no owner
- **THEN** the grid states that no owners match that prefix
- **AND** the search field still contains the term

#### Scenario: No owners exist
- **WHEN** the owner list is empty and no search is active
- **THEN** the grid states that there are no owners yet

#### Scenario: The request fails
- **WHEN** the list request fails
- **THEN** the grid presents an error message, distinct from the no-results message

### Requirement: Adding an owner is always reachable

The control for adding an owner SHALL remain available in every state of the grid, including when
no results are displayed.

#### Scenario: Adding after a fruitless search
- **WHEN** a search returns no owners
- **THEN** the user can still start adding a new owner from that screen

### Requirement: The most recent request determines what is displayed

When several list requests are in flight — from rapid pager clicks, or a search issued while a
previous load is pending — the grid SHALL display the result of the **most recently issued**
request. An earlier response arriving late SHALL NOT overwrite a newer one.

#### Scenario: Rapid pager clicks
- **WHEN** the user clicks the next-page control three times in quick succession
- **THEN** the grid ends on the third page requested, and the pager agrees with the rows displayed

#### Scenario: Searching during an in-flight load
- **WHEN** the user searches while the initial full-list request is still pending
- **THEN** the grid shows the search results, not the full list

### Requirement: Concurrent insertions may shift the result set between page requests

Pagination is positional. The system SHALL NOT guarantee that paging through a result set being
modified concurrently visits every owner exactly once. This limitation is accepted deliberately:
removing it requires cursor-based paging, which cannot support jumping to a page, reporting a total
count, or addressable page links — all of which this capability requires.

#### Scenario: An owner is inserted while the user pages
- **WHEN** another user registers an owner that sorts before the current page while the user pages forward
- **THEN** an owner may be seen twice, or missed
- **AND** this is accepted behaviour, not a defect
