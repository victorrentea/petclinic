Feature: Browse owners page by page
  As a clinic user
  I want to sort the owners and move through them a page at a time
  So that I can scan the clinic's owners however many there are

  # Other suites add owners to the same database while this runs:
  # the steps check order and counts, never which owners they are.

  @generate_sequence
  Scenario: Sorted by city, five per page, page 2 continues page 1
    When I open the owners page
    And I sort the owners by City
    And I show 5 owners per page
    Then owners 1 to 5 are listed, in city order
    When I go to the next page of owners
    Then owners 6 to 10 are listed, in city order, after the previous page

  Scenario: A link reopens the same page
    When I open the owners page at page 2, 5 per page, sorted by City descending
    Then owners 6 to 10 are listed, in reverse city order
    And the owners are sorted by City descending

  Scenario: Back returns to the previous page
    When I open the owners page at page 1, 5 per page, sorted by Name ascending
    And I go to the next page of owners
    And I go back in the browser
    Then owners 1 to 5 are listed
