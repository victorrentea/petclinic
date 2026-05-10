Feature: Add a visit
  As a clinic user
  I want to record a new visit for a pet
  So that the visit history reflects what happened

  Scenario: Add a visit to an existing pet from the owner detail page
    Given an owner with at least one pet exists
    When I open that owner's detail page
    And I click "Add Visit" for the first pet
    And I fill in the visit date "2026-05-12" and a unique description
    And I submit the visit form
    Then I am back on the owner's detail page
    And the pet's visit list contains the new visit dated "2026-05-12"
