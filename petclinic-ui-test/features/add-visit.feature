Feature: Add a visit
  As a clinic user
  I want to record a new visit for a pet
  So that the visit history reflects what happened

  @generate_sequence
  Scenario: Add a visit to an existing pet from the owner detail page
    Given an owner with at least one pet exists
    When I open that owner's detail page
    And I click "Add Visit" for the first pet
    And I fill in the visit date "2026-05-12" and a unique description
    And I submit the visit form
    Then I am back on the owner's detail page
    And the pet's visit list contains the new visit dated "2026-05-12"

  Scenario: Add a back-dated visit without capturing a sequence diagram
    Given an owner with at least one pet exists
    When I open that owner's detail page
    And I click "Add Visit" for the first pet
    And I fill in the visit date "2025-02-03" and a unique description
    And I submit the visit form
    Then I am back on the owner's detail page
    And the pet's visit list contains the new visit dated "2025-02-03"

  @generate_sequence
  Scenario: Add a follow-up visit and capture its sequence diagram
    Given an owner with at least one pet exists
    When I open that owner's detail page
    And I click "Add Visit" for the first pet
    And I fill in the visit date "2026-08-20" and a unique description
    And I submit the visit form
    Then I am back on the owner's detail page
    And the pet's visit list contains the new visit dated "2026-08-20"

  Scenario: Reject a visit date before the pet birth date
    Given an owner with at least one pet exists
    When I open that owner's detail page
    And I click "Add Visit" for the first pet
    And I fill in the visit date "0009/07/20" and a unique description
    Then the visit form blocks the invalid date with a clear message

  Scenario: Reject a visit date more than one year in the future
    Given an owner with at least one pet exists
    When I open that owner's detail page
    And I click "Add Visit" for the first pet
    And I fill in a visit date more than one year in the future and a unique description
    Then the visit form blocks the invalid date with a clear message
