Feature: Search owners by last name
  As a clinic user
  I want to filter owners by typing part of a last name, a page at a time
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
  Scenario: Searching with an empty last name lists the first page of every owner
    When I open the owners page
    And I search owners for ""
    Then the first 10 owners by "name,asc" are listed in order
    And the range reads "1 – 10" of every owner

  Scenario: Paging forward reaches every owner exactly once
    When I open the owners page
    And I show 20 owners per page
    And I page forward to the last page
    Then every owner was listed exactly once, by name

  Scenario: Sorting by city, descending
    When I open the owners page
    And I sort owners by "City" "descending"
    Then the first 10 owners by "city,desc" are listed in order

  Scenario: Changing the page size returns to the first page
    When I open the owners page
    And I go to the next page
    And I show 5 owners per page
    Then the range reads "1 – 5" of every owner

  Scenario: A new search returns to the first page and keeps the sort
    When I open the owners page
    And I sort owners by "City" "ascending"
    And I go to the next page
    And I search owners for "Pot"
    Then these owners are listed in order: "Harry Potter, Beatrix Potter"
    And the range reads "1 – 2 of 2"
