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
      | search | owners                         |
      | Potter | Potter, Harry; Potter, Beatrix |
      | Pot    | Potter, Harry; Potter, Beatrix |
      | otter  |                                |
      | Harry  |                                |
      | potter |                                |
      | Zzzz   |                                |

  @generate_sequence
  Scenario: Searching with an empty last name lists every owner, paging through the grid
    When I open the owners page
    And I search owners for ""
    Then every owner in the clinic is listed, paging through the grid as needed

  Scenario: Owners can be paged and the page size changed
    When I open the owners page
    And I search owners for ""
    Then the first page shows 10 owners
    When I go to the next page of owners
    Then a different page of 10 owners is shown
    When I set the page size to 20
    Then the first page shows 20 owners
