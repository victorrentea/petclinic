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
    Then the first 10 owners by name are listed
    And the range shows owners 1 to 10 of every owner

  Scenario: Paging through every owner lists each one once, in name order
    When I open the owners page
    And I show 5 owners per page
    And I page through every owner, 5 at a time
    Then every owner was listed exactly once, in name order

  Scenario: Sorting by City twice orders the owners by city, descending
    When I open the owners page
    And I sort owners by "City"
    And I sort owners by "City"
    Then the first 10 owners by city descending are listed

  Scenario: Changing the page size goes back to the first page
    When I open the owners page
    And I go to the next page
    And I show 5 owners per page
    Then the first 5 owners by name are listed
    And the range shows owners 1 to 5 of every owner

  Scenario: A new search goes back to the first page
    When I open the owners page
    And I go to the next page
    And I search owners for "Pot"
    Then exactly these owners are listed: "Harry Potter, Beatrix Potter"
    And the range shows owners 1 to 2 of 2
