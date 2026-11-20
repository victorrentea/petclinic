Feature: Search, sort and page through the owners
  As a clinic user
  I want to filter owners by typing part of a last name, sort them and page through them
  So that I can quickly find the owners I care about, however many the clinic has

  Background:
    Given the clinic has these owners
      | name               | city            |
      | Harry Potter       | Little Whinging |
      | Beatrix Potter     | Near Sawrey     |
      | Ada Wood           | Bath            |
      | Ben Wood           | London          |
      | Clara Wood         | Bath            |
      | Allan Woodcourt    | London          |
      | Emma Woodhouse     | Highbury        |
      | Henry Woodhouse    | Highbury        |
      | Isabella Woodhouse | London          |
      | Finn Woodley       | London          |
      | Gina Woodley       | Bath            |
      | Hugo Woods         | Highbury        |
      | Dan Woodward       | Bath            |
      | Eve Woodward       | Highbury        |

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

  @generate_sequence
  Scenario: Searching with an empty last name shows the first page, with the total
    When I open the owners page
    And I search owners for ""
    Then the first 10 owners by name are listed
    And the paginator shows owners 1 – 10 of every owner in the clinic

  Scenario: Moving to the next page
    When I open the owners page
    And I search owners for "Wood"
    And I go to the next page
    Then these owners are listed, in order:
      | name         | city     |
      | Dan Woodward | Bath     |
      | Eve Woodward | Highbury |
    And the paginator shows "11 – 12 of 12"
    And the address holds "page=1"

  Scenario: Sorting by City, then by City descending on a second click
    When I open the owners page
    And I search owners for "Wood"
    And I sort by "City"
    Then the cities listed are "Bath, Bath, Bath, Bath, Highbury, Highbury, Highbury, Highbury, London, London"
    And the address holds "sort=city,asc"
    When I sort by "City" again
    Then the cities listed are "London, London, London, London, Highbury, Highbury, Highbury, Highbury, Bath, Bath"
    And the address holds "sort=city,desc"

  Scenario: Switching the page size to 5
    When I open the owners page
    And I search owners for "Wood"
    And I show 5 owners per page
    Then these owners are listed, in order:
      | name            | city     |
      | Ada Wood        | Bath     |
      | Ben Wood        | London   |
      | Clara Wood      | Bath     |
      | Allan Woodcourt | London   |
      | Emma Woodhouse  | Highbury |
    And the paginator shows "1 – 5 of 12"
    And the address holds "size=5"

  Scenario: A shared link restores the search, the sort and the page size
    When I open the link "/owners?lastName=Wood&page=0&size=5&sort=city,desc"
    Then the search box shows "Wood"
    And these owners are listed, in order:
      | name               | city     |
      | Finn Woodley       | London   |
      | Isabella Woodhouse | London   |
      | Allan Woodcourt    | London   |
      | Ben Wood           | London   |
      | Eve Woodward       | Highbury |
    And the paginator shows "1 – 5 of 12"

  Scenario: The Back button returns to the previous page
    When I open the link "/owners?lastName=Wood&size=5"
    And I go to the next page
    And I press the browser's Back button
    Then these owners are listed, in order:
      | name            | city     |
      | Ada Wood        | Bath     |
      | Ben Wood        | London   |
      | Clara Wood      | Bath     |
      | Allan Woodcourt | London   |
      | Emma Woodhouse  | Highbury |
    And the paginator shows "1 – 5 of 12"

  Scenario: No owner matches
    When I open the owners page
    And I search owners for "Zzzz"
    Then the message 'No owners with last name starting with "Zzzz"' is shown
    And neither the table nor the paginator is shown
