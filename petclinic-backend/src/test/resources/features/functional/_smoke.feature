Feature: Smoke — backend functional test infrastructure

  Scenario: Pet types lookup is seeded
    When I GET "/api/pettypes"
    Then the response status is 200
    And the response JSON array contains an item with "name" equal to "dog"
    And the response JSON array contains an item with "name" equal to "cat"
