Feature: Browse and search owners
  As a clinic user
  I want to page through owners, sort them, and filter them by a last-name prefix
  So that I can quickly find the owners I care about, however many there are

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
    Then the first 10 owners by "name,asc" are listed, in order
    And the range reads "1 – 10" of every owner in the clinic

  Scenario: Every owner is reachable page by page, each exactly once
    When I open the owners page
    And I show 20 owners per page
    And I walk to the last page
    Then every owner in the clinic was listed once, in name order

  Scenario: Sorting by City, then reversing it
    When I open the owners page
    And I sort by "City"
    Then the first 10 owners by "city,asc" are listed, in order
    When I sort by "City"
    Then the first 10 owners by "city,desc" are listed, in order

  Scenario: Changing the page size starts again from the first page
    When I open the owners page
    And I go to the next page
    And I show 5 owners per page
    Then the range reads "1 – 5" of every owner in the clinic

  Scenario: A search starts again from the first page and keeps the sorting
    When I open the owners page
    And I sort by "City"
    And I go to the next page
    And I search owners for "Pot"
    Then the range reads "1 – 2 of 2"
    And the owners named "Pot" by "city,asc" are listed, in order
