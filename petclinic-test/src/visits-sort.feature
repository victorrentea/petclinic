@fixture:default
Feature: Sort the visits grid by any column
  As a clinic user
  I want to sort the visits by the column I click
  So that I can find a visit without paging through all of them

  Scenario Outline: Clicking a column header sorts the first page by that column
    When I open the visits grid
    And I click the "<column>" header <clicks>
    Then the "<column>" values on the first page are in <order> order

    Examples:
      | column      | clicks | order      |
      | Date        | once   | ascending  |
      | Date        | twice  | descending |
      | Description | once   | ascending  |
      | Description | twice  | descending |
      | Pet         | once   | ascending  |
      | Pet         | twice  | descending |
      | Owner       | once   | ascending  |
      | Owner       | twice  | descending |
