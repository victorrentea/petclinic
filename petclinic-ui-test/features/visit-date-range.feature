Feature: Visit date must stay within a valid range (gh#40)
  A visit cannot be dated before the pet was born, nor more than one year
  into the future. The New Visit form must refuse such dates instead of
  silently saving absurd values like the year 0009 or 3000.

  Background:
    Given an owner with at least one pet exists
    And I open that owner's detail page
    And I click "Add Visit" for the first pet

  Scenario: A date far in the future is refused
    When I enter the visit date "2099-12-31"
    And I enter a visit description
    Then the New Visit form cannot be submitted
    And the form shows a visit-date range error

  Scenario: A date before the pet was born is refused
    When I enter a visit date one day before the pet's birth date
    And I enter a visit description
    Then the New Visit form cannot be submitted
    And the form shows a visit-date range error
