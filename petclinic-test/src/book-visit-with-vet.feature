Feature: Record which vet attends a visit
  As a clinic receptionist
  I want to name the vet at the moment I book a visit
  So that the pet's history and the clinic's schedule both say who is seeing the animal

  # The Gherkin half of #37, through the browser. add-visit.spec.ts tells the same booking
  # as a TypeScript DSL and stops on the owner page; this one carries on to /visits, the
  # second place the branch put a Vet column and the only one no test looked at.
  # book-visit-with-vet.feature.glue.ts binds every sentence below to the very same
  # functions the spec calls, so the mechanics are identical and the only difference left
  # to compare is the reading.

  Background:
    Given a pet registered with the clinic
    And the clinic employs at least one vet

  @generate_sequence
  Scenario: The vet chosen while booking is named everywhere the visit is listed
    When I book a visit for that pet with a vet attending
    Then that pet's history names the vet who attended
    And the clinic's visit list names that same vet against the visit

  Scenario: A visit need not be set a vet
    When I book a visit for that pet with nobody attending
    Then that pet's history says nobody attended
