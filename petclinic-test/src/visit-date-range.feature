Feature: A visit is dated between the pet's birth and one year from today.

  Background:
    Given today is 2026-09-10
    And a pet born on 2018-12-24

  @generate_sequence
  Scenario: A visit cannot predate the pet
    When I book a visit for 2018-12-23
    Then the visit is refused

  Scenario: A visit cannot be booked more than a year ahead
    When I book a visit for 2027-09-11
    Then the visit is refused
