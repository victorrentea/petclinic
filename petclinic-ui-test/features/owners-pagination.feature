Feature: Page through the owners grid
  As a clinic user
  I want the owners list to arrive one page at a time
  So that the screen stays usable when there are thousands of owners

  Background:
    Given at least 20 owners exist

  Scenario: The grid shows one server page, not the whole table
    When I open the owners page
    Then the grid shows at most 10 owners
    And the pager reports more than one page

  Scenario: Paging through the grid lists every owner exactly once
    When I open the owners page
    And I page through every page of the grid
    Then every owner was listed exactly once

  Scenario: Choosing a larger page size restarts at the first page
    When I open the owners page
    And I choose 20 owners per page
    Then the grid shows 20 owners
    And the grid is back on the first page
