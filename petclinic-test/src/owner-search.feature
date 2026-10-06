Feature: Search owners by last name
  As a clinic user
  I want to filter owners by typing part of a last name
  So that I can quickly find the owners I care about, one page at a time

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
    And the paginator counts every owner in the clinic

  Scenario: Choosing 5 rows per page
    When I open the owners page
    And I choose 5 rows per page
    Then 5 owners are listed
    And the paginator counts every owner in the clinic

  Scenario: Sorting by city
    When I open the owners page
    And I sort the owners by "City"
    Then the first 10 owners by city are listed
