@wip
Feature: A visit is dated between the pet's birth and one year from today.

  Background:
    Given today is 2026-09-10
    And a pet born on 2020-03-01

  Scenario: A visit cannot predate the pet
    When I book a visit for 2020-02-29
    Then the visit is refused

  Scenario: The reported year 0009 date is refused
    When I book a visit for 0009-07-20
    Then the visit is refused

  Scenario: A visit cannot be booked more than a year ahead
    When I book a visit for 2027-09-11
    Then the visit is refused
