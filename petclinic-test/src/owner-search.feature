Feature: Search owners by last name
  As a clinic user
  I want to filter owners by typing part of a last name
  So that I can quickly find the owners I care about

  # Owners are written the way the grid renders them — surname first — so the lists of
  # expected owners below are separated by ";", not ",": the comma is inside a name now.

  Background:
    Given the clinic has these owners
      | Potter, Harry   |
      | Potter, Beatrix |

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
  Scenario: Searching with an empty last name lists the first page of owners
    When I open the owners page
    And I search owners for ""
    Then the first page of owners is listed
