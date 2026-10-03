Feature: Search owners by last name
  As a clinic user
  I want to filter owners by typing part of a last name, and page through the matches
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

  Scenario: Paging through every owner, 5 at a time
    When I open the owners page
    And I show 5 owners per page
    And I page through to the last page
    Then every owner in the clinic was listed once, in name order

  Scenario: Sorting by city, then reversing it
    When I open the owners page
    And I sort the owners by "City"
    Then the first 10 owners by "city,asc" are listed
    When I sort the owners by "City"
    Then the first 10 owners by "city,desc" are listed

  Scenario: Changing the page size returns to the first page
    When I open the owners page
    And I go to the next page
    And I show 20 owners per page
    Then the first 20 owners by "name,asc" are listed

  Scenario: Searching from a later page returns to the first page of the matches
    When I open the owners page
    And I go to the next page
    And I search owners for "Pot"
    Then exactly these owners are listed: "Beatrix Potter, Harry Potter"
    And the paginator reads "1 – 2 of 2"
