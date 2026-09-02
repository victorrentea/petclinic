Feature: Pet enrollment

  Scenario: Enroll a new pet under an existing owner
    Given an owner "Maria Escobito" exists
    When I enroll a "dog" pet named "Rex" born on "2024-01-15" for "Maria Escobito"
    Then the response status is 201
    And owner "Maria Escobito" has 1 pet named "Rex" of type "dog"
