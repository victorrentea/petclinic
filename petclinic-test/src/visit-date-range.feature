Feature: A visit is dated between the pet's birth and one year from today

  # The lower bound applies only when the pet's birth date is on record.
  Scenario Outline: Both edges of the range are allowed
    Then a visit dated <date> is <verdict>

    Examples:
      | date                                | verdict  |
      | the day before the pet's birth date | refused  |
      | the pet's birth date                | accepted |
      | one year from today                 | accepted |
      | the day after one year from today   | refused  |
