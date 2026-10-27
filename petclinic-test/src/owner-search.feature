@fixture:default
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
    Then the first page lists 10 owners out of every owner in the clinic

  Scenario: Choosing 5 owners per page
    When I open the owners page
    And I choose 5 owners per page
    Then the first page lists 5 owners out of every owner in the clinic

  Scenario: Sorting owners by city
    When I open the owners page
    And I sort owners by city
    Then the listed owners are in alphabetical order of city

  Scenario: Coming back from an owner's details keeps the page and the order
    When I open the owners page
    And I sort owners by city
    And I go to the next page of owners
    And I open the first listed owner and go back
    Then page 2 sorted by city is shown
