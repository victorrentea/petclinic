Feature: The owners grid tells you what it can do, and holds still while you do it
  As a clinic user scanning a long list of owners
  I want the grid to advertise which columns sort, and not to reshuffle itself under my eyes
  So that I can re-sort without losing the row I was reading

  Background:
    Given the clinic has these owners
      | Harry Potter   |
      | Beatrix Potter |

  @generate_sequence
  Scenario: Sorting by city is answered by the server, one page at a time
    When I open the owners page
    And I sort the grid by "city"
    Then the owners listed, in order, are
      | Long Silver       |
      | Tintin Reporter   |
      | Henry Baskerville |
      | Mister Geppetto   |
      | Charles Dickens   |
      | Hermione Granger  |
      | Rubeus Hagrid     |
      | Salazar Slytherin |
      | Lady Tremaine     |
      | Argus Filch       |
    And the pager reports every owner in the clinic

  Scenario: A sortable column says so before you touch it
    When I open the owners page
    Then these columns show a sort arrow at rest
      | name     |
      | city     |
      | petCount |
    And the arrow of the sorted column is the most prominent one

  Scenario: Re-sorting does not shift the columns sideways
    When I open the owners page
    And I note where the columns are
    And I sort the grid by "city"
    And I sort the grid by "city"
    Then the columns are exactly where they were
