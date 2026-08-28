Feature: Search owners by last name
  As a clinic user
  I want to filter owners by typing part of a last name
  So that I can quickly find the owners I care about

  # Owner names are listed one per row: since the grid renders "Potter, Harry",
  # a comma-separated cell can no longer be split into two owners.

  Background:
    Given the clinic has these owners
      | Potter, Harry   |
      | Potter, Beatrix |

  Scenario: The whole last name matches
    When I open the owners page
    And I search owners for "Potter"
    Then exactly these owners are listed
      | Potter, Harry   |
      | Potter, Beatrix |

  Scenario: A prefix of the last name matches
    When I open the owners page
    And I search owners for "Pot"
    Then exactly these owners are listed
      | Potter, Harry   |
      | Potter, Beatrix |

  Scenario Outline: The filter is a case-sensitive prefix of the last name, and nothing else
    When I open the owners page
    And I search owners for "<search>"
    Then no owners are listed

    Examples:
      | search |
      | otter  |
      | Harry  |
      | potter |
      | Zzzz   |

  # Owners are paged now, so an empty search no longer empties the whole table into the
  # browser: it lists the first page and the pager accounts for the rest. Walking every
  # page is owners-pagination.feature's job.
  @generate_sequence
  Scenario: Searching with an empty last name lists the first page of every owner
    When I open the owners page
    And I search owners for ""
    Then at most 10 owners are listed
    And the pager reports every owner in the clinic in total
