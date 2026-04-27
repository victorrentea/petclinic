Feature: Owner Management
  As a clinic administrator
  I want to manage owners and their pets
  So that the clinic can keep track of patients and their owners

  Background:
    Given a owner "George Franklin" exists with address "Baker St 221B" city "London" telephone "1234567890"
    And that owner has a pet "Rosy" of type "dog"

  # ─── GET owner by ID ───────────────────────────────────────────────────────

  Scenario: Retrieve an existing owner by ID
    When I request the owner by ID
    Then the response contains owner first name "George" and last name "Franklin"

  Scenario: Retrieve a non-existing owner returns 404
    When I request owner with ID 99999
    Then the response status is 404

  # ─── LIST / SEARCH owners ──────────────────────────────────────────────────

  Scenario: List all owners includes the created owner
    When I request all owners
    And the owner list contains "George" "Franklin"

  Scenario: Filter owners by last name returns matching owner
    Given another owner "Betty Davis" exists
    When I search owners with query "Dav"
    And the owner list contains "Betty" "Davis"
    And the owner list does not contain last name "Franklin"

  Scenario Outline: Filter owners by <field> substring returns matching owner
    Given another owner "<name>" with address "<address>" exists
    When I search owners with query "<query>"
    And the owner list contains "<firstName>" "<lastName>"

    Examples:
      | field     | name          | address      | query    | firstName | lastName  |
      | last name | Joe JavaBeans | Oak Street 5 | Bean     | Joe       | JavaBeans |
      | address   | Joe Smith     | JavaLane 1   | JavaLane | Joe       | Smith     |

  Scenario: Filter owners with no match returns empty list
    When I search owners with query "NonExistent"
    And the owner list is empty

  # ─── CREATE owner ──────────────────────────────────────────────────────────

  Scenario: Create a valid owner
    When I create an owner with first name "Eduardo" last name "Rodriquez" address "2693 Commerce St." city "McFarland" telephone "6085558763"
    Then the response status is 201

  Scenario: Create an owner without first name is rejected
    When I create an owner without a first name last name "Rodriquez" address "2693 Commerce St." city "McFarland" telephone "6085558763"
    Then the response status is 400

  # ─── UPDATE owner ──────────────────────────────────────────────────────────

  Scenario: Update an owner with an ID in the request body
    When I update the owner setting first name to "GeorgeI" with the owner ID in the body
    Then the response status is 2xx
    And the owner's first name is now "GeorgeI"

  Scenario: Update an owner without an ID in the request body
    When I update the owner setting first name to "GeorgeII" without the owner ID in the body
    Then the response status is 2xx
    And the owner's first name is now "GeorgeII"

  Scenario: Update an owner with an empty first name is rejected
    When I update the owner setting first name to ""
    Then the response status is 4xx

  # ─── DELETE owner ──────────────────────────────────────────────────────────

  Scenario: Delete an existing owner
    When I delete the owner
    Then the response status is 2xx
    And requesting the owner by ID returns 404

  Scenario: Delete a non-existing owner returns 4xx
    When I delete owner with ID 9999
    Then the response status is 4xx

  # ─── CREATE pet ────────────────────────────────────────────────────────────

  Scenario: Add a valid pet to an owner
    When I add a pet named "Max" of the existing type to the owner
    Then the response status is 201

  Scenario: Add a pet without a name is rejected
    When I add a pet without a name of the existing type to the owner
    Then the response status is 400

  # ─── GET owner's pet ───────────────────────────────────────────────────────

  Scenario: Retrieve an existing pet of an owner
    When I request the owner's pet
    And the pet name is "Rosy"

  Scenario: Retrieve a pet for a non-existing owner returns 404
    When I request pet of owner with ID 99999
    Then the response status is 404

  Scenario: Retrieve a non-existing pet of an owner returns 404
    When I request pet with ID 99999 of the owner
    Then the response status is 404

  # ─── UPDATE owner's pet ────────────────────────────────────────────────────

  Scenario: Update an existing pet of an owner
    When I update the owner's pet name to "Rosy Updated"
    Then the response status is 2xx

  Scenario: Update a pet with a non-existing owner still succeeds
    When I update pet with owner ID 99999 setting name to "Thor"
    Then the response status is 2xx

  Scenario: Update a non-existing pet of an owner returns 404
    When I update pet with ID 99999 of the owner setting name to "Ghost"
    Then the response status is 404

  # ─── Owner details include pets ────────────────────────────────────────────

  Scenario: Owner details include pets with their type
    When I request the owner by ID
    And the owner has 1 pet
    And the first pet is named "Rosy" with type "dog"

