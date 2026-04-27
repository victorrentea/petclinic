Feature: Owner REST API

  Background:
    Given a test owner "George" "Franklin" exists with a pet "Rosy" of type "dog"

  # ── GET /api/owners/{id} ───────────────────────────────────────────────────

  Scenario: Get owner by ID - found
    When I request the test owner by ID
    Then the response status is 200
    And the owner firstName is "George"
    And the owner lastName is "Franklin"

  Scenario: Get owner by ID - not found
    When I get owner with ID 99999
    Then the response status is 404

  # ── GET /api/owners ────────────────────────────────────────────────────────

  Scenario: List all owners
    When I get all owners
    Then the response status is 200
    And the response contains the test owner

  Scenario: Filter owners by last name - match
    Given another owner "Betty" "DavXYZ" exists
    When I search owners with query "DavXYZ"
    Then the response status is 200
    And the response contains owner with lastName "DavXYZ"
    And the response does not contain the test owner

  Scenario: Filter owners by address or city
    Given another owner "John" "JavaBeans" exists
    When I search owners with query "JavaBeans"
    Then the response status is 200
    And the response contains owner with lastName "JavaBeans"

  Scenario: Filter owners - no match
    When I search owners with query "ZZZNonExistentZZZ"
    Then the response status is 200
    And the response is an empty list

  # ── POST /api/owners ───────────────────────────────────────────────────────

  Scenario: Create owner - valid
    When I create a valid owner
    Then the response status is 201

  Scenario: Create owner - invalid missing firstName
    When I create an owner without firstName
    Then the response status is 400

  # ── PUT /api/owners/{id} ──────────────────────────────────────────────────

  Scenario: Update owner - with body ID
    When I update the test owner firstName to "GeorgeI" with body ID
    Then the response status is 2xx
    And the test owner firstName is now "GeorgeI"

  Scenario: Update owner - without body ID
    When I update the test owner firstName to "GeorgeII" without body ID
    Then the response status is 2xx
    And the test owner firstName is now "GeorgeII"

  Scenario: Update owner - invalid empty firstName
    When I update the test owner with empty firstName
    Then the response status is 4xx

  # ── DELETE /api/owners/{id} ───────────────────────────────────────────────

  Scenario: Delete owner - found
    When I delete the test owner
    Then the response status is 2xx
    And requesting the test owner returns 404

  Scenario: Delete owner - not found
    When I delete owner with ID 9999
    Then the response status is 4xx

  # ── POST /api/owners/{id}/pets ────────────────────────────────────────────

  Scenario: Add pet to owner - valid
    When I add a pet "Max" to the test owner
    Then the response status is 201

  Scenario: Add pet to owner - invalid missing name
    When I add a nameless pet to the test owner
    Then the response status is 400

  # ── GET /api/owners/{id}/pets/{petId} ─────────────────────────────────────

  Scenario: Get owner pet - found
    When I get the test pet of the test owner
    Then the response status is 200
    And the response pet name is "Rosy"

  Scenario: Get owner pet - owner not found
    When I get the test pet of owner with ID 99999
    Then the response status is 404

  Scenario: Get owner pet - pet not found
    When I get pet with ID 99999 of the test owner
    Then the response status is 404

  # ── PUT /api/owners/{id}/pets/{petId} ─────────────────────────────────────

  Scenario: Update owner pet - ok
    When I update the test owner's test pet name to "Rosy Updated"
    Then the response status is 2xx

  Scenario: Update owner pet - owner not found returns 2xx
    When I update the test pet for owner with ID 99999
    Then the response status is 2xx

  Scenario: Update owner pet - pet not found returns 404
    When I update pet with ID 99999 for the test owner
    Then the response status is 404

  # ── Owner response includes pets ──────────────────────────────────────────

  Scenario: Get owner includes pets with type populated
    When I request the test owner by ID
    Then the response status is 200
    And the response includes 1 pet named "Rosy" with type "dog"

e
