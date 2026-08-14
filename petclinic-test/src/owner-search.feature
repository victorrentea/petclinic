Feature: Browse and search the owners grid
  As a clinic user
  I want the owners listed a page at a time, ordered and filtered by last name
  So that I can find the owners I care about without loading the whole clinic

  Background:
    Given the clinic has these owners
      | Harry Potter   |
      | Beatrix Potter |

  Scenario Outline: Filter owners by a case-sensitive prefix of the last name
    When I open the owners page
    And I search owners for "<search>"
    Then exactly these owners are listed: "<owners>"

    Examples:
      | search | owners                       |
      | Potter | Harry Potter, Beatrix Potter |
      | Pot    | Harry Potter, Beatrix Potter |
      | otter  |                              |
      | Harry  |                              |
      | potter |                              |
      | Zzzz   |                              |

  Scenario: A link carrying page, size and sort renders that exact view
    When I open the owners page at "?page=2&size=5&sort=city,asc"
    Then the owners listed, in order, are
      | Alonso Quixano |
      | Harry Potter   |
      | James Bond     |
      | George Darling |
      | Wendy Darling  |

  @generate_sequence
  Scenario: The default view is the first ten owners, ordered by name
    When I open the owners page
    And I search owners for ""
    Then the owners listed, in order, are
      | Henry Baskerville |
      | James Bond        |
      | Sam Carraclough   |
      | George Darling    |
      | Wendy Darling     |
      | Charles Dickens   |
      | John Dolittle     |
      | Argus Filch       |
      | Mister Geppetto   |
      | Hermione Granger  |
    And the pager reports every owner in the clinic
