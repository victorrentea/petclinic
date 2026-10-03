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
  Scenario: Opening the owners page shows the first page by name, and how many there are
    When I open the owners page
    Then the first 10 owners matching "" by Name ascending are listed, out of all that match

  Scenario: Paging forward reaches every owner exactly once
    When I open the owners page
    And I show 20 owners per page
    And I page forward to the last page
    Then every owner in the clinic was listed exactly once, by Name ascending

  Scenario: Sorting by city, then reversing it, starts again from the first page
    When I open the owners page
    And I go to the next page
    And I sort the owners by "City"
    Then the first 10 owners matching "" by City ascending are listed, out of all that match
    When I sort the owners by "City"
    Then the first 10 owners matching "" by City descending are listed, out of all that match

  Scenario: A new page size starts again from the first page
    When I open the owners page
    And I go to the next page
    And I show 5 owners per page
    Then the first 5 owners matching "" by Name ascending are listed, out of all that match

  Scenario: A new search starts again from the first page, keeping the sort
    When I open the owners page
    And I sort the owners by "City"
    And I go to the next page
    And I search owners for "Potter"
    Then the first 10 owners matching "Potter" by City ascending are listed, out of all that match
