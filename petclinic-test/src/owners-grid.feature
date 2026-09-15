Feature: Owners grid — sort by a column, browse by pages
  As a clinic user
  I want the owners list sorted by the column I pick and split into pages
  So that a clinic with 100.000 owners stays readable

  Background:
    Given the clinic has these owners
      | Darling, George  |
      | Darling, Wendy   |
      | Dickens, Charles |
      | Dolittle, John   |

  Scenario Outline: Sorting by Name uses last name, then first name; by City, then id
    When I open the owners page
    And I search owners for "D"
    And I sort owners by "<column>" <direction>
    Then the owners are listed in this order: "<owners>"

    Examples:
      | column | direction  | owners                                                            |
      | Name   | ascending  | Darling, George; Darling, Wendy; Dickens, Charles; Dolittle, John |
      | Name   | descending | Dolittle, John; Dickens, Charles; Darling, Wendy; Darling, George |
      | City   | ascending  | Dickens, Charles; Darling, George; Darling, Wendy; Dolittle, John |

  Scenario Outline: A page holds only its slice of the sorted clinic
    When I open the owners page
    And I show <size> owners per page
    And I go to page <page>
    Then exactly these owners are listed: "<owners>"

    Examples:
      | size | page | owners                                                                                                                                     |
      | 5    | 5    | Riddle, Tom; Scamander, Newt; Schroedinger, Erwin; Silver, Long; Śliwiński, Salazar                                                        |
      | 5    | 6    | Tremaine, Lady; Weasley, Ronald; Wensleydale, Wallace                                                                                       |
      | 20   | 2    | Riddle, Tom; Scamander, Newt; Schroedinger, Erwin; Silver, Long; Śliwiński, Salazar; Tremaine, Lady; Weasley, Ronald; Wensleydale, Wallace  |

  @generate_sequence
  Scenario: Walking every page lists each owner exactly once
    When I open the owners page
    And I show 5 owners per page
    Then every owner in the clinic is listed

  Scenario: A deep link restores the exact view
    When I open the owners page at "page=1&size=5&sort=CITY&dir=desc"
    Then the owners are listed in this order: "Dolittle, John; Liddell, Alice; Weasley, Ronald; Potter, Beatrix; Holmes, Sherlock"
