@fixture:default
Feature: Sort the visits grid by any column
  As a clinic user
  I want to sort the visits by clicking a column header
  So that I can find a visit by whatever I remember about it

  Scenario Outline: Clicking the <column> header <clicks> sorts the first page <direction>
    When I open the visits grid
    And I click the "<column>" header <clicks>
    Then the "<column>" values on the first page are in <direction> order

    Examples:
      | column      | clicks | direction  |
      | Date        | once   | ascending  |
      | Date        | twice  | descending |
      | Description | once   | ascending  |
      | Description | twice  | descending |
      | Pet         | once   | ascending  |
      | Pet         | twice  | descending |
      | Owner       | once   | ascending  |
      | Owner       | twice  | descending |
