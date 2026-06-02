Feature: Owner list URL-driven sort and pagination state
  As a clinic user
  I want sort, page, and filter to be reflected as URL query params
  So that I can share or bookmark a specific owners table view

  Scenario: Initial sort indicator shown on load and rows are ordered by name
    Given I open the owners list page with no query parameters
    Then the "Name" column header shows the ascending sort indicator
    And the owner names in the table are in ascending alphabetical order

  Scenario: Sort column change updates URL and rows are reordered
    Given I open the owners list page with no query parameters
    When I click the "City" column header to sort
    Then the URL contains the query param "sort" with value starting with "city"
    And the URL contains the query param "page" with value "0"
    And the owner cities in the table are in ascending alphabetical order

  Scenario: Page change updates URL
    Given I open the owners list page with no query parameters
    When I navigate to page 2 via the paginator
    Then the URL contains the query param "page" with value "1"

  Scenario: Search resets to page 0
    Given I open the owners list page at page 1
    When I search for last name "Davis"
    Then the URL contains the query param "page" with value "0"
    And the URL contains the query param "lastName" with value "Davis"
