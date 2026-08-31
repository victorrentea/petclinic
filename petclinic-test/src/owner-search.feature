Feature: Browse and search owners
  As a clinic user
  I want the owners screen to hand me one ordered page at a time
  So that I can find the owners I care about without waiting for the whole clinic

  # Expectations are written the way the Name column renders an owner — family name
  # first — and are separated by ";", because each name already contains a comma.
  Background:
    Given the clinic has these owners
      | Potter, Harry   |
      | Potter, Beatrix |

  Scenario Outline: Filter owners by a case-sensitive prefix of the last name
    When I open the owners page
    And I search owners for "<search>"
    Then exactly these owners are listed: "<owners>"

    Examples:
      | search | owners                         |
      | Potter | Potter, Harry; Potter, Beatrix |
      | Pot    | Potter, Harry; Potter, Beatrix |
      | otter  |                                |
      | Harry  |                                |
      | potter |                                |
      | Zzzz   |                                |

  @generate_sequence
  Scenario: The first page of owners is listed
    When I open the owners page
    Then these owners are listed in order:
      | Baskerville, Henry |
      | Bond, James        |
      | Carraclough, Sam   |
      | Darling, George    |
      | Darling, Wendy     |
      | Dickens, Charles   |
      | Dolittle, John     |
      | Filch, Argus       |
      | Geppetto, Mister   |
      | Granger, Hermione  |
    And the paginator reports the total number of owners in the clinic

  Scenario: Choosing a smaller page size asks the server for a shorter page
    When I open the owners page
    And I choose a page size of 5
    Then these owners are listed in order:
      | Baskerville, Henry |
      | Bond, James        |
      | Carraclough, Sam   |
      | Darling, George    |
      | Darling, Wendy     |
    And the URL carries "size=5"
    And the paginator reports the total number of owners in the clinic

  Scenario: The second page continues the first and repeats none of it
    When I open the owners page
    And I note the owners listed on this page
    And I go to the next page
    Then these owners are listed in order:
      | Hagrid, Rubeus     |
      | Holmes, Sherlock   |
      | Liddell, Alice     |
      | McCallister, Kevin |
      | Poirot, Hercule    |
      | Potter, Beatrix    |
      | Potter, Harry      |
      | Quixano, Alonso    |
      | Radcliff, Roger    |
      | Reporter, Tintin   |
    And none of the owners I noted are listed

  Scenario: Sorting by Name orders by family name, then given name
    When I open the owners page
    And I sort by "City"
    And I sort by "Name"
    Then these owners are listed in order:
      | Baskerville, Henry |
      | Bond, James        |
      | Carraclough, Sam   |
      | Darling, George    |
      | Darling, Wendy     |
      | Dickens, Charles   |
      | Dolittle, John     |
      | Filch, Argus       |
      | Geppetto, Mister   |
      | Granger, Hermione  |

  Scenario: Sorting by City reorders the whole collection, not just the page
    When I open the owners page
    And I sort by "City"
    Then the URL carries "sort=city,asc"
    And these owners are listed in order:
      | Silver, Long        |
      | Reporter, Tintin    |
      | Baskerville, Henry  |
      | Geppetto, Mister    |
      | Dickens, Charles    |
      | Hagrid, Rubeus      |
      | Granger, Hermione   |
      | Slytherin, Salazar  |
      | Tremaine, Lady      |
      | Filch, Argus        |

  Scenario: Searching from a later page comes back to the first page of the matches
    When I open the owners page at "page=2&size=5"
    And I search owners for "Pot"
    Then these owners are listed in order:
      | Potter, Beatrix |
      | Potter, Harry   |
    And the paginator reports 2 owners in total

  Scenario: A grid view is restored from its URL
    When I open the owners page at "page=1&size=20&sort=city,asc"
    Then the grid lists 8 owners
    And the paginator reports the total number of owners in the clinic
