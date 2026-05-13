Feature: Owner management

  Background:
    Given owner "George Franklin" lives at "123 Unique Search Street" in "CaseTown" with telephone "1234509876"
    And owner "George Franklin" has a "dog" pet named "Orbit" born on "2020-03-15"

  Scenario: Fetch an owner by id
    When I fetch the owner "George Franklin"
    Then the response status is 200
    And the response JSON number field "id" equals the id of owner "George Franklin"
    And the response JSON field "firstNme" equals "George"
    And the response JSON field "lastName" equals "Franklin"

  Scenario: Missing owner returns not found
    When I GET "/api/owners/99999"
    Then the response status is 404

  Scenario: List all owners
    When I GET "/api/owners"
    Then the response status is 200
    And the response JSON array has size 1
    And the response JSON array contains owner "George Franklin"

  Scenario Outline: Search owners by visible content, case-insensitively
    When I search owners with query "<query>"
    Then the response status is 200
    And the response JSON array has size 1
    And the response JSON array contains owner "George Franklin"

    Examples:
      | query         |
      | george frank  |
      | unique search |
      | casetown      |
      | 0987          |
      | orBIT         |

  Scenario: Search owners with no match
    When I search owners with query "NonExistent"
    Then the response status is 200
    And the response JSON array has size 0

  Scenario: Update an owner while including an ignored body id
    When I update owner "George Franklin" to first name "GeorgeI" with body id
    Then the response status is 200
    And owner "George Franklin" now has first name "GeorgeI"

  Scenario: Update an owner without a body id
    When I update owner "George Franklin" to first name "GeorgeII" without body id
    Then the response status is 200
    And owner "George Franklin" now has first name "GeorgeII"

  Scenario: Reject an invalid owner update
    When I update owner "George Franklin" with an invalid empty first name
    Then the response status is 400

  Scenario: Delete an owner
    When I delete owner "George Franklin"
    Then the response status is 200
    And owner "George Franklin" is not found

  Scenario: Deleting a missing owner fails
    When I DELETE "/api/owners/9999"
    Then the response status is 404

  Scenario: Reject an invalid pet creation
    When I add a pet without a name to owner "George Franklin" with type "dog" and birth date "2020-01-01"
    Then the response status is 400

  Scenario: Fetch an owner's pet
    When I fetch pet "Orbit" of owner "George Franklin"
    Then the response status is 200
    And the response JSON number field "id" equals the id of pet "Orbit" for owner "George Franklin"
    And the response JSON field "name" equals "Orbit"

  Scenario: Missing owner for pet fetch returns not found
    When I fetch pet "Orbit" of owner "George Franklin" using missing owner id
    Then the response status is 404

  Scenario: Missing pet for owner returns not found
    When I fetch a missing pet of owner "George Franklin"
    Then the response status is 404

  Scenario: Update an owner's pet
    When I update pet "Orbit" of owner "George Franklin" to name "Rosy Updated" born on "2020-01-15" with type "dog"
    Then the response status is 200
    And pet "Orbit" of owner "George Franklin" now has name "Rosy Updated" and type "dog"

  Scenario: Updating a pet with a missing owner id still succeeds
    When I update pet "Orbit" of owner "George Franklin" using missing owner id to name "Thor" born on "2020-03-15" with type "dog"
    Then the response status is 200

  Scenario: Updating a missing pet returns not found
    When I update a missing pet of owner "George Franklin" to name "Ghost" born on "2020-01-01" with type "dog"
    Then the response status is 404
