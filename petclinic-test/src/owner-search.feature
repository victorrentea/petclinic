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
      | search | owners                         |
      | Potter | Potter, Harry; Potter, Beatrix |
      | Pot    | Potter, Harry; Potter, Beatrix |
      | otter  |                                |
      | Harry  |                                |
      | potter |                                |
      | Zzzz   |                                |

  @generate_sequence
  Scenario: Paging through the owners lists every owner exactly once
    When I open the owners page
    And I page through every page of owners
    Then every owner in the clinic was listed exactly once

  Scenario: Page through the owners
    When I open the owners page
    And I choose 5 owners per page
    Then 5 owners are listed
    When I go to the next page
    Then page 2 is shown

  Scenario: Sort by city descending
    When I open the owners page
    And I sort owners by "City" descending
    Then the owners are listed in descending city order

  Scenario: Searching resets to the first page
    When I open the owners page
    And I go to the next page
    And I search owners for "Pot"
    Then exactly these owners are listed: "Potter, Beatrix; Potter, Harry"
    And page 1 is shown
