Feature: Search owners by last name
  As a clinic user
  I want to filter owners by typing part of a last name
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

  Scenario: Paging forward reaches every owner exactly once, in name order
    When I open the owners page
    And I show 5 owners per page
    Then paging to the end lists every owner in the clinic once, by name

  Scenario: Sorting by city, descending
    When I open the owners page
    And I sort the owners by "City"
    And I sort the owners by "City"
    Then the first page lists the owners by "city,desc"

  Scenario: Changing the page size starts again from the first page
    When I open the owners page
    And I go to the next page
    And I show 20 owners per page
    Then the page range starts at owner 1

  Scenario: A new search starts again from the first page
    When I open the owners page
    And I go to the next page
    And I search owners for "Pot"
    Then exactly these owners are listed: "Harry Potter, Beatrix Potter"
    And the page range reads "1 – 2 of 2"
