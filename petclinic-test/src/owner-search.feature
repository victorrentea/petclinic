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
  Scenario: Searching with an empty last name shows the first page and total
    When I open the owners page
    And I search owners for ""
    Then page 1 of size 10 is listed in "name,asc" order for prefix ""
    And only Name and City can be sorted

  Scenario Outline: Traverse every seeded owner in stable sorted pages
    Given the clinic has more than 20 owners
    When I open the owners page
    And I choose 5 owners per page
    And I sort owners by "<sort>"
    Then every owner is reachable in "<sort>" order without missing or duplicate IDs

    Examples:
      | sort      |
      | name,asc  |
      | name,desc |
      | city,asc  |
      | city,desc |

  Scenario: Changing page size resets to the first page
    When I open the owners page
    And I go to the next owners page
    Then page 2 of size 10 is listed in "name,asc" order for prefix ""
    When I choose 5 owners per page
    Then page 1 of size 5 is listed in "name,asc" order for prefix ""
    When I go to the next owners page
    And I choose 20 owners per page
    Then page 1 of size 20 is listed in "name,asc" order for prefix ""

  Scenario: Changing sort on a later page resets to the first page
    When I open the owners page
    And I go to the next owners page
    And I sort owners by "city,desc"
    Then page 1 of size 10 is listed in "city,desc" order for prefix ""

  Scenario: Submitting a prefix resets the page and keeps the selected sort
    When I open the owners page
    And I sort owners by "city,desc"
    And I go to the next owners page
    And I draft owner prefix "Pot"
    And I go to the next owners page
    Then page 3 of size 10 is listed in "city,desc" order for prefix ""
    When I search owners for "Pot"
    Then page 1 of size 10 is listed in "city,desc" order for prefix "Pot"
    When I search owners for ""
    Then page 1 of size 10 is listed in "city,desc" order for prefix ""
