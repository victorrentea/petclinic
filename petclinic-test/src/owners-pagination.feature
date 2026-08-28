Feature: Browse owners page by page
  As a clinic user
  I want the owners list split into pages I can sort and navigate
  So that I can find an owner without scrolling through the whole clinic

  Background:
    Given the clinic has these owners
      | Potter, Harry      |
      | Potter, Beatrix    |
      | Darling, Wendy     |
      | Darling, George    |
      | Bond, James        |
      | Poirot, Hercule    |
      | McCallister, Kevin |
      | Bărbulescu, Ștefan |
      | Șerban, Andrei     |

  Scenario: The list opens on the first page, ten owners at a time
    When I open the owners page
    Then at most 10 owners are listed
    And the pager reports every owner in the clinic in total

  Scenario Outline: The user picks how many owners fit on a page
    When I open the owners page
    And I set the page size to <size>
    Then at most <size> owners are listed
    And the pager reports every owner in the clinic in total

    Examples:
      | size |
      | 5    |
      | 10   |
      | 20   |

  Scenario: The first page is sorted by last name, then first name
    When I open the owners page
    And I sort owners by "Name" ascending
    Then the owners are listed in this order
      | Bărbulescu, Ștefan |
      | Baskerville, Henry |
      | Bond, James        |
      | Carraclough, Sam   |
      | Darling, George    |
      | Darling, Wendy     |

  # Sorting happens in the database, so this asserts the database's collation, not the UI's.
  # The clinic is seeded en_US.UTF-8, which orders dictionary-style: a Romanian diacritic sorts
  # as the letter it decorates. Both ends of the alphabet are pinned, because each catches a
  # different half of the mistake:
  #
  #   ascending  -- 'Bărbulescu' opens the list, because Bar... < Bas...
  #   descending -- 'Șerban' stays down among the S names instead of leading the whole list
  #
  # Switch the database to the C collation and both flip: byte-wise, the multi-byte 'ă' and 'Ș'
  # outrank every ASCII letter, so 'Bărbulescu' falls behind 'Bond' and 'Șerban' jumps above
  # 'Wensleydale'. That is the regression these two scenarios exist to catch.
  Scenario: A diacritic sorts as its base letter, not after Z
    When I open the owners page
    And I sort owners by "Name" descending
    Then the owners are listed in this order
      | Wensleydale, Wallace |
      | Weasley, Ronald      |
      | Tremaine, Lady       |
      | Silver, Long         |
      | Șerban, Andrei       |

  # The scenario that catches the LIMIT/OFFSET bug. Six owners live in London,
  # so with no tiebreaker the database is free to return the tied rows in a
  # different order for each page: one owner then appears on two pages and
  # another is never shown at all. Only walking every page exposes it.
  Scenario: Paging through a column full of ties loses nobody
    When I open the owners page
    And I set the page size to 5
    And I sort owners by "City" ascending
    And I walk from the first page to the last page
    Then every owner in the clinic was listed exactly once

  # Searched for, because with 29 seeded owners the Potters are not on the first page.
  Scenario: A name is shown the way it is sorted and searched
    When I open the owners page
    And I search owners for "Potter"
    Then the owners list contains "Potter, Harry"
    And the owners list does not contain "Harry Potter"

  Scenario: Only Name and City can be sorted
    When I open the owners page
    Then these columns offer a sort control
      | Name |
      | City |
    And these columns offer no sort control
      | Address   |
      | Telephone |
      | Pets      |

  Scenario: Searching starts again from the first page and keeps the sorting
    When I open the owners page
    And I set the page size to 5
    And I sort owners by "City" descending
    And I go to page 2
    And I search owners for "Potter"
    Then exactly these owners are listed
      | Potter, Beatrix |
      | Potter, Harry   |
    And the pager reports page 1
    And the owners are still sorted by "City" descending

  Scenario: Coming back from an owner lands on the page I left
    When I open the owners page
    And I set the page size to 5
    And I go to page 2
    And I open the owner "Dolittle, John"
    And I go back
    Then the pager reports page 2
    And at most 5 owners are listed

  # Deliberately NOT @generate_sequence: this scenario walks every page, so the diagram
  # would repeat the pets/visits N+1 once per page (~180 arrows). owner-search.feature
  # keeps the tag on its single-request empty search, which is the picture worth reading.
  Scenario: An empty search no longer lists every owner at once
    When I open the owners page
    And I search owners for ""
    Then at most 10 owners are listed
    And the pager reports every owner in the clinic in total
    And paging to the last page lists every owner in the clinic
