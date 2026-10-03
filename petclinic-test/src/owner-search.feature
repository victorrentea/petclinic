Feature: Search owners by last name
  As a clinic user
  I want to filter owners by typing part of a last name, and browse them a page at a time
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
    Then the first 10 owners sorted by "name,asc" are listed, in order
    And the range shows "1 – 10" of every owner in the clinic

  Scenario: Paging through every owner lists each one once, in name order
    Given the clinic has more than 20 owners
    When I open the owners page
    And I show 20 owners per page
    And I page through to the last page
    Then every owner in the clinic was listed once, in name order

  Scenario: Sorting by city, then reversing it
    When I open the owners page
    And I sort the owners by "City"
    Then the first 10 owners sorted by "city,asc" are listed, in order
    When I sort the owners by "City"
    Then the first 10 owners sorted by "city,desc" are listed, in order

  Scenario: Changing the page size starts again from the first page
    When I open the owners page
    And I go to the next page of owners
    And I show 5 owners per page
    Then the range shows "1 – 5" of every owner in the clinic

  Scenario: A new search starts again from the first page
    When I open the owners page
    And I go to the next page of owners
    And I search owners for "Pot"
    Then the range shows "1 – 2" of 2
    And exactly these owners are listed: "Harry Potter, Beatrix Potter"
