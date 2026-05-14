Feature: Visits

  Background:
    Given an owner "Peter McTavish" with a "dog" pet "Samantha"
    And a veterinarian "James Carter"
    And a veterinarian "Helen Leary"

  Scenario: Schedule a visit for a pet
    When I schedule a visit for "Samantha" on "2026-05-10" with description "rabies shot" and veterinarian "James Carter"
    Then the response status is 201
    And "Samantha" has 1 visit with description "rabies shot"
    And that visit is assigned to veterinarian "James Carter"

  Scenario: Edit a visit description
    Given a visit for "Samantha" on "2026-04-01" described as "checkup" with veterinarian "James Carter"
    When I update that visit's description to "annual checkup" and veterinarian to "Helen Leary"
    Then the response status is 200
    And the visit's description is "annual checkup"
    And that visit is assigned to veterinarian "Helen Leary"
