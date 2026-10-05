Feature: Browse owners page by page, sorted by name or city
  As front desk staff
  I want to sort the owners and move through them one page at a time
  So that I can find anyone however many owners the clinic has

  # Other suites add owners to the same database while this runs:
  # the steps check order and counts, never which owners appear.

  @generate_sequence
  Scenario: Sort by city, show 5 owners per page, go to the second page, refresh
    When I open the owners page
    Then 10 owners are listed, sorted by name
    When I sort the owners by "City"
    Then 10 owners are listed, sorted by city
    When I show 5 owners per page
    Then the paginator shows owners 1 to 5
    When I go to the next page
    Then the paginator shows owners 6 to 10
    And 5 owners are listed, sorted by city, following the previous page
    When I refresh the screen
    Then the paginator shows owners 6 to 10
    And 5 owners are listed, sorted by city
