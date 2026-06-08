Feature: Sort and paginate the Owners list
  As a clinic user
  I want to sort and page through the owners list
  So that I can find an owner without scrolling through hundreds of thousands of rows

  # Source: openspec change add-owners-pagination-sorting,
  # spec owners-list — scenarios "Navigate between pages" and "Two-state sort toggle on a single column".
  # DRAFT for business review — not yet implemented.

  Scenario: Navigate between pages and see the range label update
    Given there are more owners than fit on one page
    And I am on the Owners screen showing the first page of 10 owners
    When I click "next page"
    Then the second page of owners is shown
    And the range label reads "Showing 11–20 of <total>"
    When I click "previous page"
    Then the first page of owners is shown again
    And the range label reads "Showing 1–10 of <total>"

  Scenario: Toggle sorting on the Name column
    Given I am on the Owners screen
    And the owners are sorted by last name ascending by default
    And each Name cell shows the last name first, e.g. "Carter Adam"
    When I click the "Name" column header
    Then the owners are sorted by last name descending
    When I click the "Name" column header again
    Then the owners are sorted by last name ascending
