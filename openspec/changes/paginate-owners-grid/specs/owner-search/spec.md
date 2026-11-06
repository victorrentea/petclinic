# Spec Delta

## Purpose

Lets clinic staff find an owner from the beginning of the last name, typed the way people type,
without matching case or diacritics.

## ADDED Requirements

### Requirement: Search matches the beginning of the last name
The system SHALL filter owners, through the `lastName` parameter of `GET /api/owners`, to those whose whole last name starts with the given text. The filter SHALL combine with paging and sorting, and totals SHALL count only matching owners.

#### Scenario: Prefix
- **WHEN** a client searches for `Pot` and `Harry Potter` and `Beatrix Potter` exist
- **THEN** both owners are returned and `totalElements` is 2

#### Scenario: Not a prefix
- **WHEN** a client searches for `otter`
- **THEN** no owners are returned

#### Scenario: A later word of the last name
- **WHEN** a client searches for `Garcia` and `Juan Carlos Martín García Lorca` exists
- **THEN** that owner is not returned

#### Scenario: Blank search
- **WHEN** a client omits `lastName` or sends it empty
- **THEN** the system pages through all owners

### Requirement: Search ignores case
The system SHALL match the last name regardless of letter case.

#### Scenario: Lower case
- **WHEN** a client searches for `potter`
- **THEN** `Harry Potter` and `Beatrix Potter` are returned

### Requirement: Search ignores diacritics
The system SHALL match the last name regardless of diacritics, in the stored name and in the search text.

#### Scenario: Typed without diacritics
- **WHEN** a client searches for `Mures`
- **THEN** `Ștefan Mureșan` is returned

#### Scenario: Letter with a stroke
- **WHEN** a client searches for `sli`
- **THEN** `Łukasz Śliwiński` is returned

#### Scenario: Typed with diacritics
- **WHEN** a client searches for `Mureșan`
- **THEN** `Ștefan Mureșan` is returned

### Requirement: Search text is literal
The system SHALL treat `%` and `_` in the search text as ordinary characters.

#### Scenario: Wildcard character
- **WHEN** a client searches for `%`
- **THEN** only owners whose last name starts with `%` are returned

### Requirement: The grid searches on demand
The grid SHALL run the search when the user presses Find Owner, not on each keystroke, and SHALL show the first page of results.

#### Scenario: Searching from a later page
- **WHEN** a user on page 3 searches for `Potter`
- **THEN** the grid shows the first page of matching owners

### Requirement: The grid explains an empty result
The grid SHALL state that no owner matches when a search finds nothing, and SHALL keep Add Owner available.

#### Scenario: No match
- **WHEN** a user searches for `Zzzz`
- **THEN** the grid says no owner's last name starts with `Zzzz`
- **AND** the Add Owner button stays visible
