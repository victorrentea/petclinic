Feature: Visits

  Background:
    Given an owner "Peter McTavish" with a "dog" pet "Samantha"

  Scenario: Schedule a visit for a pet
    When I schedule a visit for "Samantha" on "2026-05-10" with description "rabies shot"
    Then the response status is 201
    And "Samantha" has 1 visit with description "rabies shot"

  Scenario: Edit a visit description
    Given a visit for "Samantha" on "2026-04-01" described as "checkup"
    When I update that visit's description to "annual checkup"
    Then the response status is 200
    And the visit's description is "annual checkup"

  Scenario: Renaming a visit leaves the vet who attended it alone
    Given a visit for "Samantha" on "2026-04-01" described as "checkup" attended by vet "Leary"
    When I update that visit's description to "annual checkup"
    Then the response status is 200
    And the visit is still attended by vet "Leary"
