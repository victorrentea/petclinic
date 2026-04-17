Feature: Owner Management
  As a clinic receptionist
  I want to manage pet owner records
  So that I can track who owns which pets

  Scenario: Look up an existing owner by ID
    Given owner "George Franklin" is registered
    When I look up that owner
    Then the response status is 200
    And the owner name is "George" "Franklin"

  Scenario: Unknown owner ID returns 404
    When I look up owner with ID 99999
    Then the response status is 404

  Scenario Outline: Search finds owners by any text field (partial, case-insensitive)
    Given owner "Betty Davis" lives at "22 Main St" in "Seattle"
    When I search owners for "<query>"
    Then "Betty Davis" is in the results

    Examples:
      | query   | note                        |
      | Dav     | last name, partial          |
      | av     | last name, partial          |
      | dav     | last name, lowercase        |
      | DAV     | last name, uppercase        |
      | Main    | address, partial            |
      | main    | address, lowercase          |
      | Seattle | city, exact                 |
      | eattl   | city, partial               |

  Scenario: Search excludes non-matching owners
    Given owner "George Franklin" is registered
    And owner "Betty Davis" is registered
    When I search owners for "dav"
    Then "Betty Davis" is in the results
    But "George Franklin" is not in the results

  Scenario: Empty search returns all owners
    Given owner "George Franklin" is registered
    And owner "Betty Davis" is registered
    When I search owners for ""
    Then "George Franklin" is in the results
    And "Betty Davis" is in the results

  Scenario: No results for unknown term
    When I search owners for "Xyzzy_NotHere"
    Then the results are empty


  Scenario: Register a new owner
    When I register owner "Eduardo" "Rodriquez" at "2693 Commerce St." in "McFarland" tel "6085558763"
    Then the response status is 201

  Scenario: First name is mandatory when registering
    When I register owner "" "Rodriquez" at "2693 Commerce St." in "McFarland" tel "6085558763"
    Then the response status is 400

  Scenario: Update owner details
    Given owner "George Franklin" is registered
    When I rename that owner to "George II" "Franklin"
    Then the response status is 200
    And looking up that owner shows "George II" "Franklin"

  Scenario: Delete an owner
    Given owner "George Franklin" is registered
    When I delete that owner
    Then the response status is 200
    And looking up that owner returns 404

  Scenario: Owners list is paginated
    When I list owners page 0 size 5
    Then the response status is 200
    And the page metadata shows number 0 and size 5
    And totalElements is at least 1

  Scenario: Sort owners by first name ascending
    Given owner "Zelda Anderson" is registered
    And owner "Aaron Brown" is registered
    When I list owners page 0 size 100 sorted by "firstName" asc
    Then the owners are in ascending first-name order

  Scenario: Unknown sort field is rejected with 400
    When I list owners page 0 size 10 sorted by "telephone" asc
    Then the response status is 400

  Scenario: Oversized page is capped at 500 records
    When I list owners page 0 size 999999
    Then the response status is 200
    And the actual page size is at most 500

  Scenario: Search result count reflects the filter
    Given owner with last name "XyzSmithBDD" is registered
    And owner with last name "XyzSmithBDD2" is registered
    And owner with last name "XyzJonesBDD" is registered
    When I search owners for "XyzSmithBDD" page 0 size 10
    Then totalElements is 2
    And the results contain 2 owners

