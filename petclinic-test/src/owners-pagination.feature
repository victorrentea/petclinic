Feature: Reading the owners list a page at a time
  As a clinic receptionist
  I want the owners list broken into pages I can sort and step through
  So that I can find an owner quickly, and still can when the clinic has 100,000 of them

  # Every owner named below is really in the clinic's records.
  # Names are shown surname first — "Potter, Harry" — because that is the order
  # the list is sorted in, so what you read matches what you see.

  Background:
    Given the clinic has 28 owners

  Scenario: The list opens on the first 10 owners, in name order
    When I open the owners page
    Then I see 10 owners
    And the first owner is "Baskerville, Henry"
    And the last owner is "Granger, Hermione"
    And I am told there are 28 owners in total

  Scenario: Owners who share a surname stay together and in order
    When I open the owners page
    And I go to page 2
    Then "Potter, Beatrix" is listed immediately before "Potter, Harry"

  Scenario Outline: I can choose how many owners to see at once
    When I open the owners page
    And I show <size> owners per page
    Then I see <size> owners
    And I can step through <pages> pages

    Examples:
      | size | pages |
      | 5    | 6     |
      | 10   | 3     |
      | 20   | 2     |

  Scenario: The last page holds only the owners that are left
    When I open the owners page
    And I show 10 owners per page
    And I go to the last page
    Then I see 8 owners

  # --- The one that matters most -------------------------------------------
  # Paging shows a slice of an ordered list. If the order is not completely
  # settled, two owners can trade places between one page and the next: one is
  # then shown on both pages and the other on neither — and the missing owner
  # simply looks like a record that was never there.
  #
  # City is the sharpest test we have. Seven owners live in London, and at 5 per
  # page that group is split across a page boundary — precisely where the
  # problem would appear.
  Scenario: Stepping through every page shows each owner once and only once
    When I open the owners page
    And I show 5 owners per page
    And I sort by City
    And I step through all 6 pages
    Then I have seen all 28 owners
    And no owner was shown twice
    And no owner was missed

  Scenario: The same walk gives the same result every time
    When I open the owners page
    And I show 5 owners per page
    And I sort by City
    And I step through all 6 pages
    And I step through all 6 pages again
    Then both walks listed the owners in the same order

  Scenario: Sorting by City groups the London owners together
    When I open the owners page
    And I show 20 owners per page
    And I sort by City
    Then the owners living in "London" are listed one after another

  Scenario: Sorting can be reversed
    When I open the owners page
    And I sort by Name in reverse
    Then the first owner is "Wensleydale, Wallace"

  # Salazar Śliwiński is spelled with Ś. A reader looking for him runs their
  # finger down the S's — so that is where he must be, not stranded at the very
  # end of the list after every other owner.
  Scenario: A name spelled with an accent is filed under its plain letter
    When I open the owners page
    And I show 20 owners per page
    And I go to the last page
    Then "Śliwiński, Salazar" is listed between "Silver, Long" and "Tremaine, Lady"

  Scenario: Searching narrows the list and starts again from the first page
    When I open the owners page
    And I show 5 owners per page
    And I go to page 4
    And I search owners for "Pot"
    Then I see 2 owners
    And I am told there are 2 owners in total
    And I am looking at the first page

  Scenario: A search that matches nobody says so
    When I open the owners page
    And I search owners for "Zzzz"
    Then I am told that no owners were found

  Scenario: Coming back to a link shows the same page again
    When I open the owners page
    And I show 5 owners per page
    And I sort by City
    And I go to page 3
    And I reload the page
    Then I am still on page 3
    And I am still showing 5 owners per page
    And the owners are still sorted by City
