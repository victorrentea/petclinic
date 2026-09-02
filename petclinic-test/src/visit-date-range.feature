Feature: A visit date must fall between the pet's birth date and one year ahead
  As a clinic user
  I want the visit date to be refused when it predates the pet or sits far in the future
  So that a typo like the year 0009 never reaches the schedule

  # GitHub issue #40. The rule is stated once and enforced twice, because the form
  # is not the only way in: the MCP server and the chatbot post to the same API.
  # The UI scenarios therefore never submit — the browser's job is to refuse first —
  # and the API scenarios prove the refusal survives with no browser involved.

  Background:
    Given an owner with a pet whose birth date the clinic knows

  Scenario: The form refuses a date from before the pet was born
    When I open the New Visit form for that pet
    And I enter the visit date "0009/07/20"
    Then the form says the date is before the pet's birth date
    And the visit cannot be submitted

  Scenario: The form refuses a date more than a year ahead
    When I open the New Visit form for that pet
    And I enter a visit date 2 years from today
    Then the form says the date is too far in the future
    And the visit cannot be submitted

  Scenario: The form accepts today
    When I open the New Visit form for that pet
    And I enter today as the visit date
    Then the form reports no problem with the date
    And the visit can be submitted

  Scenario: The API refuses a date from before the pet was born
    When the API is asked to book a visit dated "0009-07-20"
    Then the API refuses it, blaming the pet's birth date

  Scenario: The API refuses a date more than a year ahead
    When the API is asked to book a visit 2 years from today
    Then the API refuses it, blaming the one-year limit
