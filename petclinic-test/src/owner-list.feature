@fixture:default
Feature: Browse the owners one page at a time
  As a clinic user
  I want the owners grid to show one page in the order I choose, and to keep its place
  So that I can browse tens of thousands of owners and share or come back to where I was

  # The 26 owners of the Default dataset (db/seed/R__seed.sql). Names and cities sort by
  # ICU rules: "Śliwiński" sits between "Silver" and "Tremaine", not after every ASCII name.
  # Ordering by city breaks ties by name, in the same direction as the city.

  Scenario: Showing 20 owners per page
    Given I open the owners page
    When I show 20 owners per page
    Then 20 owners are listed, from "Baskerville, Henry" to "Riddle, Tom"
    And the paginator reads "1 – 20 of 26"

  Scenario: Moving to the next page
    Given I open the owners page
    When I go to the next page
    Then the owners listed are:
      | Name                             | City            |
      | Holmes, Sherlock                 | London          |
      | Liddell, Alice                   | Oxford          |
      | Martín García Lorca, Juan Carlos | Madrid          |
      | McCallister, Kevin               | Winnetka        |
      | Mureșan, Ștefan                  | Vienna          |
      | Potter, Beatrix                  | Near Sawrey     |
      | Potter, Harry                    | Little Whinging |
      | Quixano, Alonso                  | La Mancha       |
      | Reporter, Tintin                 | Brussels        |
      | Riddle, Tom                      | Wiltshire       |
    And the paginator reads "11 – 20 of 26"

  Scenario: Sorting by City, then reversing it
    Given I open the owners page
    When I sort the owners by "City"
    Then the "City" column is sorted ascending
    And the owners listed are:
      | Name               | City          |
      | Silver, Long       | Bristol       |
      | Reporter, Tintin   | Brussels      |
      | Baskerville, Henry | Dartmoor      |
      | Geppetto, Mister   | Florence      |
      | Dickens, Charles   | Higham        |
      | Granger, Hermione  | Hogsmeade     |
      | Hagrid, Rubeus     | Hogsmeade     |
      | Tremaine, Lady     | Ile-de-France |
      | Filch, Argus       | Inverness     |
      | Śliwiński, Łukasz  | Kraków        |
    When I sort the owners by "City"
    Then the "City" column is sorted descending
    And the owners listed are:
      | Name                             | City        |
      | Carraclough, Sam                 | Yorkshire   |
      | McCallister, Kevin               | Winnetka    |
      | Riddle, Tom                      | Wiltshire   |
      | Wensleydale, Wallace             | Wigan       |
      | Schroedinger, Erwin              | Vienna      |
      | Mureșan, Ștefan                  | Vienna      |
      | Dolittle, John                   | Puddleby    |
      | Liddell, Alice                   | Oxford      |
      | Potter, Beatrix                  | Near Sawrey |
      | Martín García Lorca, Juan Carlos | Madrid      |
    And the paginator reads "1 – 10 of 26"

  Scenario: A shared link opens the page it names
    When I open the link "/owners?page=2&size=5&sort=city,desc"
    Then the "City" column is sorted descending
    And the owners listed are:
      | Name                             | City        |
      | Mureșan, Ștefan                  | Vienna      |
      | Dolittle, John                   | Puddleby    |
      | Liddell, Alice                   | Oxford      |
      | Potter, Beatrix                  | Near Sawrey |
      | Martín García Lorca, Juan Carlos | Madrid      |
    And the paginator reads "6 – 10 of 26"

  Scenario: Back from an owner's details returns to the same page
    Given I open the owners page
    And I sort the owners by "City"
    And I go to the next page
    And I go to the next page
    When I open the details of "Riddle, Tom"
    And I go back
    Then the "City" column is sorted ascending
    And the owners listed are:
      | Name                 | City      |
      | Mureșan, Ștefan      | Vienna    |
      | Schroedinger, Erwin  | Vienna    |
      | Wensleydale, Wallace | Wigan     |
      | Riddle, Tom          | Wiltshire |
      | McCallister, Kevin   | Winnetka  |
      | Carraclough, Sam     | Yorkshire |
    And the paginator reads "21 – 26 of 26"

  Scenario: A link to a page past the end lands on the last page
    When I open the link "/owners?page=9&size=10"
    Then the owners listed are:
      | Name                 | City          |
      | Scamander, Newt      | London        |
      | Schroedinger, Erwin  | Vienna        |
      | Silver, Long         | Bristol       |
      | Śliwiński, Łukasz    | Kraków        |
      | Tremaine, Lady       | Ile-de-France |
      | Wensleydale, Wallace | Wigan         |
    And the paginator reads "21 – 26 of 26"
