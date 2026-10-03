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
    Then the first 10 owners by name are listed
    And the range reads "1 – 10" of every owner in the clinic

  Scenario: Paging to the end shows every owner exactly once
    When I open the owners page
    And I show 5 owners per page
    Then paging to the end shows every owner once, in name order

  Scenario Outline: Sort by Name or City, never by nothing
    When I open the owners page
    And I search owners for "Pot"
    And I click the "<column>" header <clicks>
    Then these owners are listed in order: "<owners>"

    Examples:
      | column | clicks  | owners                       |
      | Name   | 1 time  | Harry Potter, Beatrix Potter |
      | Name   | 2 times | Beatrix Potter, Harry Potter |
      | City   | 1 time  | Harry Potter, Beatrix Potter |
      | City   | 2 times | Beatrix Potter, Harry Potter |

  Scenario: A new page size goes back to the first page
    When I open the owners page
    And I go to the next page
    And I show 20 owners per page
    Then the first 20 owners by name are listed

  Scenario: A new sort goes back to the first page
    When I open the owners page
    And I go to the next page
    And I click the "City" header 1 time
    Then the first 10 owners by city are listed

  Scenario: A new search goes back to the first page and keeps the sort
    When I open the owners page
    And I click the "City" header 2 times
    And I go to the next page
    And I search owners for "Pot"
    Then these owners are listed in order: "Beatrix Potter, Harry Potter"
    And the range reads "1 – 2 of 2"
