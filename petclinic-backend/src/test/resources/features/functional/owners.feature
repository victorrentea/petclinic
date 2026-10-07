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
    And the response JSON array has size 2
    And every item in the response has "lastName" equal to "Davis"

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
