Feature: Owner list pagination and sorting
  As a clinic receptionist
  I want to browse owners with pagination and sorting
  So that I can find owners efficiently without loading all records

  Background:
    Given the following owners exist
      | firstName | lastName  | city       | address          | telephone  |
      | Alice     | Anderson  | Boston     | 1 Main St        | 1111111111 |
      | Bob       | Brown     | Chicago    | 2 Oak Ave        | 2222222222 |
      | Carol     | Clark     | Boston     | 3 Pine Rd        | 3333333333 |
      | Dave      | Davis     | Denver     | 4 Elm St         | 4444444444 |
      | Eve       | Evans     | Chicago    | 5 Maple Ave      | 5555555555 |

  Scenario: First page with default size returns paginated envelope
    When I request GET "/api/owners"
    Then the response status is 200
    And the response contains a "content" array
    And the response contains "totalElements" greater than 0
    And the response contains "totalPages" greater than 0

  Scenario: Explicit page and size
    When I request GET "/api/owners?page=0&size=2"
    Then the response status is 200
    And the response "size" is 2
    And the response "number" is 0
    And the "content" array has at most 2 owners

  Scenario: Filtering by lastName with pagination
    When I request GET "/api/owners?lastName=And&page=0&size=10"
    Then the response status is 200
    And all owners in "content" have lastName starting with "And"
    And the response "totalElements" equals the count of owners with lastName starting with "And"

  Scenario: Empty result when lastName filter matches nothing
    When I request GET "/api/owners?lastName=ZZZNOTEXISTS"
    Then the response status is 200
    And the "content" array is empty
    And the response "totalElements" is 0

  Scenario: Sort by Name column ascending
    When I request GET "/api/owners?sort=firstName,asc&sort=lastName,asc&page=0&size=10"
    Then the response status is 200
    And the owners in "content" are ordered by full name ascending

  Scenario: Sort by Name column descending
    When I request GET "/api/owners?sort=firstName,desc&sort=lastName,desc&page=0&size=10"
    Then the response status is 200
    And the owners in "content" are ordered by full name descending

  Scenario: Sort by city ascending
    When I request GET "/api/owners?sort=city,asc&page=0&size=10"
    Then the response status is 200
    And the "content" owners are ordered by "city" ascending

  Scenario: Unsupported sort field is rejected
    When I request GET "/api/owners?sort=telephone,asc"
    Then the response status is 400
