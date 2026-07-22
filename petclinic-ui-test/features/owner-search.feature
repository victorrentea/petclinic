Feature: Search owners by last name
  As a clinic user
  I want to filter owners by typing part of a last name
  So that I can quickly find the owners I care about

  @generate_sequence
  Scenario: Filter owners by a last name part
    Given at least one owner exists
    When I open the owners page
    And I search for owners by a last name part
    Then only owners whose last name starts with that part are listed
