@fixture:default
Feature: Search owners by last name
  As a clinic user
  I want to filter owners by typing part of a last name
  So that I can quickly find the owners I care about

  Background:
    Given the clinic has these owners
      | Potter, Harry   |
      | Potter, Beatrix |

  Scenario Outline: Filter owners by a case-sensitive prefix of the last name
    When I open the owners page
    And I search owners for "<search>"
    Then exactly these owners are listed: "<owners>"

    Examples:
      | search | owners                          |
      | Potter | Potter, Harry; Potter, Beatrix  |
      | Pot    | Potter, Harry; Potter, Beatrix  |
      | otter  |                                 |
      | Harry  |                                 |
      | potter |                                 |
      | Zzzz   |                                 |

  Scenario: A search that matches nobody says so
    When I open the owners page
    And I search owners for "Zzzz"
    Then I am told no owner's last name starts with "Zzzz"

  @generate_sequence
  Scenario: Searching with an empty last name pages through every owner
    When I open the owners page
    And I search owners for ""
    Then 10 owners are listed, from "Baskerville, Henry" to "Hagrid, Rubeus"
    And the paginator reads "1 – 10 of 26"
