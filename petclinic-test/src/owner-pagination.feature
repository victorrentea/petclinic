Feature: Page and sort the owners grid
  As a clinic user
  I want the owners list to arrive one screen at a time, ordered by a column I pick
  So that the list stays usable once the clinic holds far more owners than fit a screen

  Scenario Outline: The page size selector decides how many owners a screen holds
    When I open the owners page
    And I show <size> owners per page
    Then the grid shows <size> owners

    Examples:
      | size |
      | 5    |
      | 10   |
      | 20   |

  Scenario: Next and previous move through the pages without repeating an owner
    When I open the owners page
    And I show 5 owners per page
    And I go to the next page
    Then the grid shows 5 owners
    And none of them appeared on the previous page
    When I go to the previous page
    Then the grid is back on the first page of owners

  Scenario: The grid opens ordered by name, and the header reverses it
    When I open the owners page
    Then the owners are sorted by Name
    When I sort by Name
    Then the owners are sorted by Name in reverse
    When I sort by Name
    Then the owners are sorted by Name

  Scenario: Clicking City sorts by city, and again reverses it
    When I open the owners page
    And I sort by City
    Then the owners are sorted by City
    When I sort by City
    Then the owners are sorted by City in reverse

  Scenario: A deep link lands on exactly the page it names
    When I open the owners page at page 2 of size 5 sorted by CITY descending
    Then the grid shows 5 owners
    And the paginator reports page 3
