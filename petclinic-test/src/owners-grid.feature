Feature: Browse owners a page at a time
  As clinic staff
  I want to page through the owners and sort them by name or city
  So that I can find someone even when the clinic has thousands of owners

  Scenario: Choosing how many owners a page shows
    When I open the owners page
    And I choose 5 owners per page
    Then 5 owners are listed
    And the total number of owners is shown

  @generate_sequence
  Scenario: Sorting by city, then reversing it
    When I open the owners page
    And I sort the owners by "City"
    And I sort the owners by "City"
    Then the owners are listed by city, descending
    And "City" shows the descending arrow

  Scenario: Coming back from an owner keeps my place
    Given I am on page 2 of the owners sorted by city
    When I open the first owner listed
    And I go back
    Then I am still on page 2 of the owners sorted by city

  Scenario: Searching for a last name nobody has
    When I open the owners page
    And I search owners for "Zzzz"
    Then I am told that no owner matches
    And I can still add an owner
