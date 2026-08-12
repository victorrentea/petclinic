Feature: Search owners by last name
  As a clinic user
  I want to filter owners by typing part of a last name
  So that I can quickly find the owners I care about

  # This scenario exists only as Gherkin — there is no owner-search.spec.ts twin.
  # The field's whole contract is a table of what-you-type / who-shows-up, which
  # is exactly what a Scenario Outline says better than code: one sentence, many
  # rows, readable by whoever owns the requirement.
  #
  # @generate_sequence sits on a single Examples block, not on the outline, so
  # exactly one row records a Tempo window and becomes a .puml — the other rows
  # run as plain assertions.
  Scenario Outline: Filter owners by a last name part
    Given the clinic's sample owners are loaded
    When I open the owners page
    And I search owners for "<search>"
    Then exactly these owners are listed: "<owners>"

    @generate_sequence
    Examples: a last name two owners share
      | search | owners                       |
      | Potter | Harry Potter, Beatrix Potter |

    Examples: any prefix of the last name narrows the list — and nothing else does
      | search  | owners                                                        |
      | Darling | George Darling, Wendy Darling                                 |
      | Sl      | Salazar Slytherin                                             |
      | D       | John Dolittle, George Darling, Wendy Darling, Charles Dickens |
      | otter   |                                                               |
      | Harry   |                                                               |
      | potter  |                                                               |
      | Zzzz    |                                                               |

  # The one row a table cannot hold: an empty field takes a different branch in
  # the UI — it re-lists everyone instead of calling the search endpoint.
  Scenario: Emptying the last name field brings every owner back
    Given the clinic's sample owners are loaded
    When I open the owners page
    And I search owners for "Potter"
    And I search owners for ""
    Then every owner in the clinic is listed
