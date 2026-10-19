# Spec Delta

## Purpose

Lets clinic staff browse owners one page at a time, in an order they choose, so the list stays fast
and readable as the clinic grows toward 10,000 owners.

## ADDED Requirements

### Requirement: Owners are listed one page at a time
The owner list SHALL return a single page of owners, together with the total number of owners matching
the filter. The page number starts at 0. The page size SHALL be one of 5, 10 or 20, with 10 as the
default.

#### Scenario: The first page by default
- **WHEN** the owner list is requested without paging parameters
- **THEN** it returns at most 10 owners
- **AND** it reports the total number of owners

#### Scenario: A chosen page size
- **WHEN** the owner list is requested with size 5 and page 1
- **THEN** it returns the 6th to the 10th owners in the current order

#### Scenario: A page past the end
- **WHEN** a page beyond the last one is requested
- **THEN** it returns no owners
- **AND** it still reports the real total

### Requirement: Owners sort by name or by city
The owner list SHALL sort by `name` or by `city`, ascending or descending, with `name` ascending as the
default. Name order is last name, then first name. City order is city, then last name, then first name.
A descending sort SHALL reverse only the chosen field. Equal values SHALL end in a fixed order, so
consecutive pages never repeat or skip an owner.

#### Scenario: Default order
- **WHEN** the owner list is requested without a sort
- **THEN** owners are ordered by last name, then first name

#### Scenario: Sort by city, descending
- **WHEN** the owner list is sorted by city, descending
- **THEN** cities appear from Z to A
- **AND** owners within the same city stay in ascending name order

#### Scenario: Identical names page stably
- **WHEN** several owners share the same first and last name and span a page boundary
- **THEN** every one of them appears on exactly one page

#### Scenario: Accented names sort where readers expect them
- **WHEN** owners with the last names "Silver", "Śliwiński" and "Tremaine" are sorted by name
- **THEN** they appear in that order

### Requirement: Paging combines with the last-name filter
The last-name prefix filter SHALL apply before paging. The reported total SHALL count only the owners
that match the filter.

#### Scenario: A filtered page
- **WHEN** the owner list is filtered by last name "Potter"
- **THEN** only owners whose last name starts with "Potter" are returned
- **AND** the total counts only those owners

### Requirement: Invalid listing parameters are rejected
The owner list SHALL reject, with a 400 validation problem naming the parameter, any of these:
- a page size other than 5, 10 or 20;
- a negative page;
- a sort field other than `name` or `city`;
- a direction other than `asc` or `desc`;
- a non-numeric page or size.

It SHALL NOT silently replace a bad value with a default.

#### Scenario: Unsupported page size
- **WHEN** the owner list is requested with size 50
- **THEN** the response is 400

#### Scenario: Unsortable column
- **WHEN** the owner list is requested sorted by telephone
- **THEN** the response is 400

#### Scenario: Negative page
- **WHEN** the owner list is requested with page -1
- **THEN** the response is 400

### Requirement: The Owners grid shows the last name first
The Name column SHALL show each owner as "last name, first name", the order it sorts in.

#### Scenario: An owner's name in the grid
- **WHEN** the grid lists Alice Liddell
- **THEN** her Name cell reads "Liddell, Alice"

### Requirement: The Owners grid pages and sorts
The Owners grid SHALL offer a paginator with 5, 10 and 20 rows per page, showing the total number of
owners. Only the Name and City headers SHALL be sortable. Clicking a sortable header SHALL sort it
ascending, then descending, with no unsorted state.

#### Scenario: Paging through owners
- **WHEN** the user moves to the next page of the grid
- **THEN** the next owners in the current order are shown

#### Scenario: Jumping to the last page
- **WHEN** the user clicks the last-page button
- **THEN** the last owners in the current order are shown

#### Scenario: Only Name and City are sortable
- **WHEN** the user views the grid headers
- **THEN** Name and City can be clicked to sort
- **AND** Address, Telephone and Pets cannot

#### Scenario: Sortable columns are visible without hovering
- **WHEN** the grid is sorted by City
- **THEN** both Name and City show a sort arrow
- **AND** the City arrow is highlighted

#### Scenario: Columns stay in place
- **WHEN** the order or the page changes
- **THEN** every column keeps its width and position

#### Scenario: Changing order or size returns to the first page
- **WHEN** the user is on page 3 and changes the sort or the page size
- **THEN** the grid shows page 1

### Requirement: Searching resets the grid to the first page
A new last-name search SHALL show page 1 of its results, keeping the current sort and page size.

#### Scenario: Searching from a later page
- **WHEN** the user is on page 2 and searches for "Potter"
- **THEN** page 1 of the matching owners is shown, in the same order and page size

### Requirement: The grid view survives navigation
The grid's page, page size, sort and search SHALL be reflected in the page URL, leaving defaults out.
Opening that URL, refreshing it, or coming back to it with Back SHALL restore the same view.

#### Scenario: Back from an owner's details
- **WHEN** the user, on page 2 sorted by city, opens an owner and then goes Back
- **THEN** the grid shows page 2 sorted by city again

#### Scenario: A shared link
- **WHEN** a user opens an Owners URL carrying a page, a size, a sort and a search
- **THEN** the grid shows exactly that view

### Requirement: Empty and failed listings are told apart
When a search matches no owner, the grid SHALL say so and SHALL still offer Add Owner. When loading
fails, the grid SHALL show the error instead of claiming there are no owners.

#### Scenario: No owner matches
- **WHEN** a search matches no owner
- **THEN** the grid says no owner's last name starts with the search text
- **AND** the Add Owner button is visible

#### Scenario: The listing fails
- **WHEN** the owner list request fails
- **THEN** the grid shows the error message
