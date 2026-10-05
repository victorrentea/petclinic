Feature: Browse owners page by page, sorted by name or city
  As front desk staff
  I want to sort the owners and move through them one page at a time
  So that I can find anyone however many owners the clinic has

  # Other suites add owners to the same database while this runs:
  # the steps check order and counts, never which owners appear.

  Scenario: The grid opens on the first 10 owners, sorted by name
    When I open the owners page
    Then 10 owners are listed, sorted by name
    And the paginator shows owners 1 to 10

  Scenario: Clicking the City header sorts by city
    Given I open the owners page
    When I sort the owners by "City"
    Then 10 owners are listed, sorted by city

  Scenario: A smaller page size shows fewer owners
    Given I open the owners page
    When I show 5 owners per page
    Then the paginator shows owners 1 to 5
    And 5 owners are listed, sorted by name

  @generate_sequence
  Scenario: The next page continues where the previous one ended
    Given I open the owners page
    And I sort the owners by "City"
    And I show 5 owners per page
    When I go to the next page
    Then the paginator shows owners 6 to 10
    And 5 owners are listed, sorted by city, following the previous page

  Scenario: A refresh keeps the page, the sort and the page size
    Given I open the second page of 5 owners sorted by city
    When I refresh the screen
    Then the paginator shows owners 6 to 10
    And 5 owners are listed, sorted by city
