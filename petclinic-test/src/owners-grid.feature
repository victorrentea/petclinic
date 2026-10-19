Feature: Browse owners page by page
  As a clinic user
  I want to see the owners a page at a time, in an order I choose
  So that I can find an owner among thousands

  Background:
    When I open the owners page

  Scenario: Sort by city, from Z to A
    When I sort the owners by "City"
    And I sort the owners by "City" again
    Then the owners are listed by city from Z to A

  Scenario: Show 5 owners per page
    When I show 5 owners per page
    Then 5 owners are listed

  Scenario: Coming back from an owner keeps the page and the order
    When I sort the owners by "City"
    And I go to the next page
    And I open the first owner listed
    And I go back
    Then page 2 of the owners by city is listed

  Scenario: Only Name and City can be sorted
    Then only "Name, City" can be sorted

  Scenario: Columns stay in place when the order changes
    When I note where the columns are
    And I sort the owners by "Name" again
    Then the columns have not moved

  Scenario: Every sortable column shows its arrow, the active one highlighted
    When I sort the owners by "City"
    Then the "City" arrow is highlighted and the "Name" arrow is dimmed
