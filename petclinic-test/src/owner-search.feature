@fixture:default
Feature: Search owners by last name
  As a clinic user
  I want to filter owners by typing the beginning of a last name
  So that I can quickly find the owners I care about

  Background:
    Given the clinic has these owners
      | Harry Potter   |
      | Beatrix Potter |
      | Ștefan Mureșan |

  Scenario Outline: Filter owners by the beginning of the last name, ignoring case and diacritics
    When I open the owners page
    And I search owners for "<search>"
    Then exactly these owners are listed: "<owners>"

    Examples:
      | search | owners                       |
      | Potter | Harry Potter, Beatrix Potter |
      | Pot    | Harry Potter, Beatrix Potter |
      | otter  |                              |
      | Harry  |                              |
      | potter | Harry Potter, Beatrix Potter |
      | mures  | Ștefan Mureșan               |
      | Zzzz   |                              |

  @generate_sequence
  Scenario: Searching with an empty last name lists every owner
    When I open the owners page
    And I search owners for ""
    Then every owner in the clinic is listed
