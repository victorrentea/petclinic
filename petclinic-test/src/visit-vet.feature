Feature: Choose the vet who attends a visit
  As a clinic user
  I want to say which vet will attend a visit when I book it
  So that the owner's page and the visits screen show who will see the pet

  Background:
    Given an owner with at least one pet

  Scenario: Book a visit attended by a vet, and see the vet on the owner page and on all visits
    When I open that owner's page
    And I start a new visit for their first pet
    And I date the visit "2026-05-12" and describe it uniquely
    And I choose the first vet the form offers
    And I submit the visit
    Then I am back on that owner's page
    And the visit on the owner's page reads the chosen vet
    When I open the all visits screen
    Then the visit on the all visits screen reads the chosen vet

  Scenario: Book a visit with nobody yet as its vet, and see it read "No vet" everywhere
    When I open that owner's page
    And I start a new visit for their first pet
    Then the form's vet field reads "No vet"
    When I date the visit "2026-05-12" and describe it uniquely
    And I submit the visit
    Then I am back on that owner's page
    And the visit on the owner's page reads "No vet"
    When I open the all visits screen
    Then the visit on the all visits screen reads "No vet"
