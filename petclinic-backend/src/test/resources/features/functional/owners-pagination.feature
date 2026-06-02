Feature: Owner list pagination and sorting

  Background:
    Given the following owners exist:
      | firstName | lastName  | city        |
      | Betty     | Davis     | Sun Prairie |
      | Carlos    | Estaban   | Waunakee    |
      | David     | Schroeder | Madison     |
      | Eduardo   | Rodriquez | McFarland   |
      | George    | Franklin  | Madison     |
      | Harold    | Davis     | Windsor     |
      | Helen     | Leary     | Waunakee    |
      | Jeff      | Black     | Monona      |
      | Joe       | Brown     | Madison     |
      | Maria     | Escobito  | Waunakee    |
      | Peter     | McTavish  | Madison     |
      | Susan     | Taylor    | Dane        |

  Scenario: Default pagination on first load
    When I GET "/api/owners"
    Then the response status is 200
    And the response contains fields "content", "totalElements", "totalPages", "number", "size"
    And the response field "number" equals 0
    And the response field "size" equals 10
    And the response field "content" has 10 items
    And the response field "content" is sorted by "firstName" ascending

  Scenario: Page navigation
    When I GET "/api/owners?page=1&size=5"
    Then the response status is 200
    And the response field "number" equals 1
    And the response field "size" equals 5
    And the response field "content" has at most 5 items
    And the response field "totalElements" equals 12

  Scenario: lastName filter with pagination
    When I GET "/api/owners?lastName=Davis&page=0&size=10"
    Then the response status is 200
    And the response field "totalElements" equals 2
    And every item in "content" has "lastName" starting with "Davis"

  Scenario: Sort by firstName ascending
    When I GET "/api/owners?sort=firstName,asc"
    Then the response status is 200
    And the response field "content" is sorted by "firstName" ascending

  Scenario: Sort by city descending
    When I GET "/api/owners?sort=city,desc"
    Then the response status is 200
    And the response field "content" is sorted by "city" descending
