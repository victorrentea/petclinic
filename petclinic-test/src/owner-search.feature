Feature: Search owners by last name
  As a clinic user
  I want to filter owners by typing part of a last name, and page through them
  So that I can quickly find the owners I care about

  Background:
    Given the clinic has these owners
      | Harry Potter   |
      | Beatrix Potter |

  Scenario Outline: Filter owners by a case-sensitive prefix of the last name
    When I open the owners page
    And I search owners for "<search>"
    Then exactly these owners are listed: "<owners>"

    Examples:
      | search | owners                       |
      | Potter | Harry Potter, Beatrix Potter |
      | Pot    | Harry Potter, Beatrix Potter |
      | otter  |                              |
      | Harry  |                              |
      | potter |                              |
      | Zzzz   |                              |

  @generate_sequence
  Scenario: Searching with an empty last name shows the first page of every owner
    When I open the owners page
    And I search owners for ""
    Then the first 10 owners by name are listed, out of every owner in the clinic

  Scenario: Paging through shows every owner exactly once, in name order
    When I open the owners page
    And I show 20 owners per page
    And I page through to the last page
    Then every owner in the clinic was shown exactly once, in name order

  Scenario: Clicking City sorts by it, and clicking it again reverses the order
    When I open the owners page
    And I sort owners by "City"
    Then the page lists the owners in "city,asc" order
    When I sort owners by "City"
    Then the page lists the owners in "city,desc" order

  Scenario: Changing the page size goes back to the first page
    When I open the owners page
    And I go to the next page
    And I show 5 owners per page
    Then the grid shows owners "1 – 5" of every owner in the clinic

  Scenario: A new search goes back to the first page and keeps the sort
    When I open the owners page
    And I sort owners by "City"
    And I go to the next page
    And I search owners for "Pot"
    Then the grid shows owners "1 – 2" of 2
    And the page lists the "Pot" owners in "city,asc" order
