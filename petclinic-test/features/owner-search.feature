Feature: Search owners by last name
  As a clinic user
  I want to filter owners by typing part of a last name
  So that I can quickly find the owners I care about

  # This scenario exists only as Gherkin — there is no owner-search.spec.ts twin.
  # The field's whole contract is a table of what-you-type / who-shows-up, which
  # is exactly what a Scenario Outline says better than code.

  # The clinic's entire owner list, seeded by Flyway (V3__sample_data.sql).
  # Spelled out here so every row below can be checked by eye, without opening
  # the SQL — and asserted, so a changed seed fails here rather than three rows
  # into an Examples table.
  Background: the owners on file
    Given the clinic has exactly these owners
      | Kevin McCallister   |
      | Harry Potter        |
      | Erwin Schroedinger  |
      | Tom Riddle          |
      | Ronald Weasley      |
      | Roger Radcliff      |
      | Newt Scamander      |
      | Alice Liddell       |
      | Henry Baskerville   |
      | John Dolittle       |
      | George Darling      |
      | James Bond          |
      | Hercule Poirot      |
      | Sam Carraclough     |
      | Beatrix Potter      |
      | Long Silver         |
      | Argus Filch         |
      | Wallace Wensleydale |
      | Wendy Darling       |
      | Rubeus Hagrid       |
      | Hermione Granger    |
      | Salazar Slytherin   |
      | Tintin Reporter     |
      | Lady Tremaine       |
      | Mister Geppetto     |
      | Alonso Quixano      |
      | Charles Dickens     |
      | Sherlock Holmes     |

  Scenario Outline: Filter owners by a last name part
    When I open the owners page
    And I search owners for "<search>"
    Then exactly these owners are listed: "<owners>"

    # The field matches a PREFIX of the LAST name, case-sensitively.
    # The four empty rows are that one rule denied, in turn:
    #   otter  — a substring of Potter, but not its start
    #   Harry  — a first name, not a last name
    #   potter — the right name, the wrong case
    #   Zzzz   — nobody
    Examples:
      | search  | owners                                                        |
      | Potter  | Harry Potter, Beatrix Potter                                  |
      | Darling | George Darling, Wendy Darling                                 |
      | Sl      | Salazar Slytherin                                             |
      | D       | John Dolittle, George Darling, Wendy Darling, Charles Dickens |
      | otter   |                                                               |
      | Harry   |                                                               |
      | potter  |                                                               |
      | Zzzz    |                                                               |

  # The one row a table cannot hold: an empty field takes a different branch in
  # the UI — it re-lists everyone instead of calling the search endpoint. That
  # branch is the one worth a diagram, so @generate_sequence sits here: it is
  # the round-trip the Examples rows only vary, and tagging one plain Scenario
  # beats tagging a table row nobody can point at.
  @generate_sequence
  Scenario: Emptying the last name field brings every owner back
    When I open the owners page
    And I search owners for "Potter"
    And I search owners for ""
    Then every owner in the clinic is listed
