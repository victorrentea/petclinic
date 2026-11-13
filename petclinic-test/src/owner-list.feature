@fixture:default
Feature: Browse owners page by page
  As a clinic user
  I want to page through the owners, ordered by name or by city
  So that I can find an owner among tens of thousands

  Scenario: Moving to the next page
    When I open the owners page
    And I go to the next page
    Then the address says page 2
    And page 2 of the owners sorted "name,asc", 10 per page, is listed

  Scenario: Showing 20 owners per page
    When I open the owners page
    And I choose 20 owners per page
    Then page 1 of the owners sorted "name,asc", 20 per page, is listed

  Scenario: Sorting by city, then reversing it
    When I open the owners page
    And I click the "City" header
    Then page 1 of the owners sorted "city,asc", 10 per page, is listed
    When I click the "City" header
    Then page 1 of the owners sorted "city,desc", 10 per page, is listed

  Scenario: Back from an owner's details returns to the same page
    When I open the owners page at "?page=2&sort=city,asc"
    And I open the first owner listed
    And I go back
    Then page 2 of the owners sorted "city,asc", 10 per page, is listed

  Scenario: A shared link opens the page it names
    When I open the owners page at "?page=2&size=5&sort=city,asc"
    Then page 2 of the owners sorted "city,asc", 5 per page, is listed

  Scenario: A link to a page past the end lands on the last page
    When I open the owners page at "?page=99"
    Then the address says the last page of 10 owners
    And the last page of the owners sorted "name,asc", 10 per page, is listed
