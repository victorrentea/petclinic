Feature: Browse the owners list
  As a clinic user
  I want to page, sort, and filter the owners list
  So that I can find any owner quickly, even when the clinic has many of them

  Background:
    Given the clinic has more than 25 owners with varied last names, addresses, and cities
    And several owners share the city "Madison"
    And at least three owners have a last name starting with "Sm"
    And an owner "George Franklin" exists with pets "Leo", "Basil", "Max"
    And an owner "Jeff Black" exists with a single pet "Lucky"
    And an owner "Maria Escobito" exists with no pets

  # ---------------------------------------------------------------------------
  # Default view, paging, and page size
  # ---------------------------------------------------------------------------

  Scenario: Default view shows the first page with 10 owners
    When I open the Owners screen with no query parameters
    Then the paginator shows page 1
    And the page-size selector shows "10"
    And the table contains at most 10 owner rows
    And the URL contains "page=0"
    And the URL contains "size=10"

  Scenario: Clicking "Next page" fetches and renders the next page
    Given I am on the Owners screen showing page 1
    When I click the paginator "Next page" control
    Then the URL contains "page=1"
    And the table shows the second page of owners
    And none of the rows from page 1 are still displayed

  Scenario Outline: Page size options are 5, 10, and 20
    Given I am on the Owners screen showing page 1
    When I change the page size to "<size>"
    Then the URL contains "size=<size>"
    And the table contains at most <size> owner rows

    Examples:
      | size |
      | 5    |
      | 10   |
      | 20   |

  # ---------------------------------------------------------------------------
  # Sortable column inventory
  # ---------------------------------------------------------------------------

  Scenario: Sort affordances are shown on Name, Address, and City only
    When I open the Owners screen
    Then the "Lastname, Firstname" column header shows a sort arrow
    And the "Address" column header shows a sort arrow
    And the "City" column header shows a sort arrow
    And the "Pets" column header does NOT show a sort arrow

  Scenario: The Pets column header is inert
    Given I am on the Owners screen with the default sort
    When I click the "Pets" column header
    Then the URL is unchanged
    And no new request to "/api/owners" is issued
    And the "Lastname, Firstname" column header still shows an ascending sort arrow

  # ---------------------------------------------------------------------------
  # Single-column sort toggling
  # ---------------------------------------------------------------------------

  Scenario: Default sort is by name ascending
    When I open the Owners screen with no "sort" parameter in the URL
    Then the "Lastname, Firstname" column header shows an ascending sort arrow
    And the visible rows are ordered by last name then first name ascending

  Scenario: Clicking a new sortable column activates it ascending
    Given I am on the Owners screen sorted by "Lastname, Firstname" ascending
    When I click the "City" column header
    Then the URL contains "sort=city,asc"
    And the "City" column header shows an ascending sort arrow
    And the "Lastname, Firstname" column header no longer shows a sort arrow

  Scenario: Clicking the active sort column flips its direction
    Given I am on the Owners screen sorted by "Lastname, Firstname" ascending
    When I click the "Lastname, Firstname" column header
    Then the URL contains "sort=name,desc"
    And the "Lastname, Firstname" column header shows a descending sort arrow

  Scenario: Clicking a descending column flips it back to ascending
    Given I am on the Owners screen sorted by "Lastname, Firstname" descending
    When I click the "Lastname, Firstname" column header
    Then the URL contains "sort=name,asc"
    And the "Lastname, Firstname" column header shows an ascending sort arrow

  # ---------------------------------------------------------------------------
  # Stable multi-column sort, observed through row ordering
  # ---------------------------------------------------------------------------

  Scenario: Sorting by city orders by city, then last name, then first name
    Given I am on the Owners screen
    When I click the "City" column header
    Then the URL contains "sort=city,asc"
    And among the rows whose city is "Madison", the rows are ordered by last name then first name ascending

  Scenario: Sorting by address orders by address, then last name, then first name
    Given two owners share the address "110 W. Liberty St."
    When I sort the Owners screen by "Address" ascending
    Then among the rows whose address is "110 W. Liberty St.", the rows are ordered by last name then first name ascending

  Scenario: id ascending is the final tiebreaker
    Given two owners share the same city, last name, and first name
    When I sort the Owners screen by "City" ascending
    Then among those identically-named rows, the one with the smaller id appears first

  # ---------------------------------------------------------------------------
  # Last-name filter
  # ---------------------------------------------------------------------------

  Scenario: Filtering by last name narrows the list and snaps to page 1
    Given I am on the Owners screen on page 4
    When I type "Sm" into the last-name filter and apply it
    Then the URL contains "lastName=Sm"
    And the URL contains "page=0"
    And every visible row's last name contains "Sm"
    And the paginator's total count reflects only the matching owners

  # ---------------------------------------------------------------------------
  # Snap-to-first-page on filter, size, or sort change
  # ---------------------------------------------------------------------------

  Scenario: Changing the page size snaps to page 1
    Given I am on the Owners screen on page 4 with page size "10"
    When I change the page size to "20"
    Then the URL contains "page=0"
    And the URL contains "size=20"
    And the paginator shows page 1

  Scenario: Changing the sort snaps to page 1
    Given I am on the Owners screen on page 4 sorted by "Lastname, Firstname" ascending
    When I click the "City" column header
    Then the URL contains "page=0"
    And the URL contains "sort=city,asc"
    And the paginator shows page 1

  # ---------------------------------------------------------------------------
  # URL as source of truth
  # ---------------------------------------------------------------------------

  Scenario: Deep link restores page, size, sort, and filter
    When I navigate directly to "/owners?page=3&size=20&sort=city,desc&lastName=Sm"
    Then the paginator shows page 4
    And the page-size selector shows "20"
    And the "City" column header shows a descending sort arrow
    And the last-name filter input contains "Sm"
    And every visible row's last name contains "Sm"

  Scenario: Interactions update the URL query string
    Given I am on the Owners screen with the default sort
    When I click the "City" column header
    Then the URL contains "sort=city,asc"
    And the "size" parameter is preserved in the URL

  Scenario: Browser Back restores the prior view
    Given I am on the Owners screen with the default sort
    When I click the "City" column header
    And I navigate to page 2 via the paginator
    And I press the browser Back button
    Then the URL no longer contains "page=1"
    And the URL contains "sort=city,asc"
    And the rendered rows, paginator, and sort arrows match the view that existed before going to page 2

  # ---------------------------------------------------------------------------
  # Loading UX — context preserved during fetch
  # ---------------------------------------------------------------------------

  Scenario: In-flight fetch keeps prior rows visible, dimmed, with a spinner overlay
    Given I am on the Owners screen showing page 1
    And the next "/api/owners" response is artificially delayed
    When I click the paginator "Next page" control
    Then the page 1 rows are still visible
    And the rows are rendered at reduced opacity
    And a spinner overlay is shown above the table

  Scenario: New rows replace the dimmed rows once the response lands
    Given a fetch is in flight with the prior page's rows dimmed
    When the "/api/owners" response arrives
    Then the dimmed rows are replaced by the new page's rows
    And the spinner overlay is no longer shown

  # ---------------------------------------------------------------------------
  # Name column rendering
  # ---------------------------------------------------------------------------

  Scenario: Name column header reads "Lastname, Firstname"
    When I open the Owners screen
    Then the name column header reads exactly "Lastname, Firstname"

  Scenario: Name cell renders as "<lastName>, <firstName>"
    When I open the Owners screen filtered by last name "Franklin"
    Then the name cell for owner "George Franklin" reads exactly "Franklin, George"

  # ---------------------------------------------------------------------------
  # Pets column rendering and markup validity
  # ---------------------------------------------------------------------------

  Scenario: Pets cell renders multiple pets as a comma-separated inline list
    When I open the Owners screen and locate the row for "George Franklin"
    Then the Pets cell text is exactly "Leo, Basil, Max"
    And the Pets cell contains no <tr> element at any nesting depth

  Scenario: Pets cell renders a single pet without a trailing comma
    When I open the Owners screen and locate the row for "Jeff Black"
    Then the Pets cell text is exactly "Lucky"
    And the Pets cell contains no <tr> element at any nesting depth

  Scenario: Pets cell is empty when the owner has no pets
    When I open the Owners screen and locate the row for "Maria Escobito"
    Then the Pets cell is empty
    And the Pets cell contains no <tr> element at any nesting depth

  Scenario: Owners table markup is valid — no <tr> nested inside any <td>
    When I open the Owners screen
    Then no <td> in the owners table contains a <tr> element at any nesting depth
