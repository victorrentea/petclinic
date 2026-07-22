Feature: Owner management

  Scenario: Register a new owner
    When I register an owner with first name "Eduardo", last name "Rodriquez", address "2693 Commerce St.", city "McFarland", telephone "6085558763"
    Then the response status is 201
    And the owner is searchable by last name "Rodriquez"

  Scenario: Search owners by last name
    Given the following owners exist:
      | firstName | lastName  |
      | George    | Franklin  |
      | Betty     | Davis     |
      | Harold    | Davis     |
    When I GET "/api/owners?lastName=Dav"
    Then the response status is 200
    And the page contains 2 owners
    And every owner on the page has "lastName" equal to "Davis"

  Scenario: Owners arrive one page at a time
    Given the following owners exist:
      | firstName | lastName |
      | Ana       | Pageable |
      | Bob       | Pageable |
      | Cleo      | Pageable |
    When I GET "/api/owners?lastName=Pageable&size=2"
    Then the response status is 200
    And the page contains 2 owners
    And the page reports 3 owners in total
    And the page is number 0 of size 2

  Scenario: Owners can be sorted by city
    Given the following owners exist:
      | firstName | lastName | city      |
      | Ana       | Sortable | Zurich    |
      | Bob       | Sortable | Amsterdam |
      | Cleo      | Sortable | Madrid    |
    When I GET "/api/owners?lastName=Sortable&sort=city,asc"
    Then the response status is 200
    And the owners on the page are sorted by "city"
    And every owner on the page has "lastName" equal to "Sortable"

  Scenario: Owner profile includes pets with their type
    Given an owner "Jean Coleman" with a "dog" pet named "Samantha" born on "2020-03-15"
    When I fetch the owner "Jean Coleman"
    Then the response status is 200
    And the owner has 1 pet
    And the pet at index 0 has name "Samantha" and type "dog"

  Scenario: Cannot register an owner without a first name
    When I POST to "/api/owners" the JSON:
      """
      {"lastName":"Rodriquez","address":"2693 Commerce St.","city":"McFarland","telephone":"6085558763"}
      """
    Then the response status is 400
