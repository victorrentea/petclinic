Feature: Page and sort the owners grid
  As a clinic user
  I want the owners grid to page through a large clinic
  So that the browser never has to load every owner at once

  Background:
    Given the clinic has these owners
      | Harry Potter   |
      | Beatrix Potter |

  Scenario: Clearing the search shows only the first page of owners
    When I open the owners page
    And I search owners for ""
    Then the first page of owners is shown

  Scenario: Navigating to the next page shows a different set of owners
    When I open the owners page
    And I search owners for ""
    Then the first page of owners is shown
    When I go to the next page of owners
    Then a different set of owners is shown than on the first page

  Scenario: Changing the page size changes how many owners are shown
    When I open the owners page
    And I search owners for ""
    And I set the owners page size to 20
    Then exactly 20 owners are listed
