Feature: Owners list — pagination
  As a clinic user
  I want the owners list to load one page at a time
  So that the screen stays fast even when there are many owners

  Background:
    Given more than 10 owners exist

  Scenario: The first page shows at most 10 owners
    When I open the owners list
    Then at most 10 owner rows are shown
    And the paginator reports the total number of owners

  Scenario: The owners list defaults to page 1, size 10, sorted by name ascending
    When I open the owners list
    Then the page size is 10
    And I am on the first page
    And the owner rows are sorted by name ascending
