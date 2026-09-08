Feature: Record which vet attended a visit
  As a clinic receptionist
  I want to name the vet attending a visit at the moment I book it
  So that a pet's history says who saw the animal, and not only when

  # The same feature as add-visit.spec.ts, told in Gherkin instead of TypeScript.
  # Nothing below names a page, a field or a button — add-visit.feature.glue.ts binds
  # each sentence to the very same functions the TypeScript scenario calls, so the
  # mechanics are identical and the only difference left to compare is the reading.

  Background:
    Given a pet registered with the clinic
    And "Helen Leary" is one of the clinic's vets

  @generate_sequence
  Scenario: A visit remembers the vet who attended it
    When I book a visit for that pet with "Helen Leary" attending
    Then that pet's history shows the visit was attended by "Helen Leary"

  Scenario: A visit nobody attended says so, rather than saying nothing
    When I book a visit for that pet with nobody attending
    Then that pet's history shows the visit was attended by nobody
