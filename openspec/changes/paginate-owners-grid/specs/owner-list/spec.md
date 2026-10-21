# Spec Delta

## Purpose

Lets clinic staff find an owner among tens of thousands: search by last name, then page and
sort the results, in the Owners grid and through `GET /api/owners`.

## ADDED Requirements

### Requirement: Owners are listed one page at a time
The system SHALL return owners one page at a time, with the total number of matching owners.
The page size SHALL be 5, 10 or 20, and 10 when not given. Pages are numbered from 0.

#### Scenario: Default page
- **WHEN** a client calls `GET /api/owners` with no paging parameters and 23 owners exist
- **THEN** the response holds the first 10 owners as `content` and `totalElements` is 23

#### Scenario: Last, partial page
- **WHEN** a client asks for `page=2&size=10` and 23 owners exist
- **THEN** `content` holds the last 3 owners and `totalElements` is 23

#### Scenario: Grid shows the range and the total
- **WHEN** staff open the Owners screen and 23 owners exist
- **THEN** the grid shows 10 rows, offers 5, 10 and 20 rows per page, and reads "1 – 10 of 23"

### Requirement: Page size is limited
The system SHALL refuse a page size other than 5, 10 or 20, so no request can return every
owner at once.

#### Scenario: Oversized page refused
- **WHEN** a client calls `GET /api/owners?size=50000`
- **THEN** the response is 400 Bad Request and names the allowed sizes

### Requirement: A page past the end is empty
The system SHALL answer a page number beyond the last page with no owners and the real total,
not with an error.

#### Scenario: Page beyond the last
- **WHEN** a client asks for `page=9&size=10` and 23 owners exist
- **THEN** the response is 200, `content` is empty and `totalElements` is 23

### Requirement: Name is shown last name first
The grid SHALL show each owner's name as last name, a comma, then first name.

#### Scenario: Name column
- **WHEN** the grid shows owner Kevin McCallister
- **THEN** the Name cell reads "McCallister, Kevin"

### Requirement: Owners sort by name
The system SHALL sort owners by last name, then first name, ascending by default, and
descending on request (`sort=name,desc`, or a second click on the Name header).

#### Scenario: Default order
- **WHEN** owners "Potter, Harry", "Darling, Wendy" and "Darling, George" exist and no sort is given
- **THEN** they are listed "Darling, George", then "Darling, Wendy", then "Potter, Harry"

#### Scenario: Descending
- **WHEN** the same owners are listed with `sort=name,desc`
- **THEN** they are listed "Potter, Harry", then "Darling, Wendy", then "Darling, George"

### Requirement: Owners sort by city
The system SHALL sort owners by city, ascending or descending, and owners in the same city
by name ascending.

#### Scenario: Same city ordered by name
- **WHEN** "Holmes, Sherlock" (London), "Mureșan, Ștefan" (Vienna) and "Darling, Wendy" (London) are
  listed with `sort=city,asc`
- **THEN** they are listed "Darling, Wendy", then "Holmes, Sherlock", then "Mureșan, Ștefan"

### Requirement: Order is total
The system SHALL break every tie on the owner's id, so that paging through any sort shows
each owner exactly once, even when owners share a name and city.

#### Scenario: Namesakes across a page boundary
- **WHEN** 6 owners are all named "Lovelace, Ada" in London and are paged with `size=5`
- **THEN** page 0 and page 1 together show all 6, none twice

### Requirement: Only Name and City are sortable
The grid SHALL offer sorting only on the Name and City columns; Address, Telephone and Pets
headers SHALL not be clickable. The API SHALL refuse any other sort key.

#### Scenario: Unsortable headers
- **WHEN** staff look at the grid's Address, Telephone and Pets headers
- **THEN** none shows a sort control and clicking them changes nothing

#### Scenario: Unknown sort key refused
- **WHEN** a client calls `GET /api/owners?sort=telephone,asc`
- **THEN** the response is 400 Bad Request and names the allowed keys `name` and `city`

#### Scenario: Header never returns to unsorted
- **WHEN** staff click the City header three times
- **THEN** the order goes ascending, descending, ascending

### Requirement: Romanian alphabetical order
The system SHALL compare last names, first names and cities in Romanian alphabetical order,
identically in every environment.

#### Scenario: Ș after S
- **WHEN** owners named Sava, Szabo, Șerban and Tudor are sorted by name
- **THEN** they are listed Sava, Szabo, Șerban, Tudor

### Requirement: Search by last name pages too
The system SHALL keep the case-sensitive last-name prefix search, apply paging and sorting
to its results, and count only the matching owners in the total.

#### Scenario: Search narrows the total
- **WHEN** staff search "Dar" and 2 of 23 owners have a last name starting with "Dar"
- **THEN** the grid shows those 2 and reads "1 – 2 of 2"

#### Scenario: New search starts at page 1
- **WHEN** staff are on page 3 and search again, change the sort, or change the page size
- **THEN** the grid shows page 1 of the new result

### Requirement: Grid cells and actions stay usable
The grid SHALL list an owner's pets as comma-separated names, and SHALL offer Add Owner
whether or not the search found anyone.

#### Scenario: Pets cell
- **WHEN** the grid shows George Darling, who owns Nana and Tinker
- **THEN** the Pets cell reads "Nana, Tinker"

#### Scenario: Add Owner after an empty search
- **WHEN** staff search a last name nobody has
- **THEN** the grid says no owners match and still offers Add Owner
