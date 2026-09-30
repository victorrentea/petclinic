# Spec Delta

## Purpose

Writes an owner's name the same way on every screen, last name first as in a register, so the
order of the Owners grid — sorted by last name — reads naturally.

## ADDED Requirements

### Requirement: An owner's name reads "Last, First"
Wherever the UI shows an owner's name, it SHALL be written as the last name, a comma and a space,
then the first name. This covers the Owners grid, the owner's record, the Visits list, the Add
and Edit Pet forms, and the Add and Edit Visit forms. Veterinarians' names are not affected.

#### Scenario: Owners grid
- **WHEN** the Owners grid lists Kevin McCallister
- **THEN** the row reads "McCallister, Kevin"

#### Scenario: Owner record
- **WHEN** the user opens Kevin McCallister's record
- **THEN** the owner information shows "McCallister, Kevin"

#### Scenario: Visits list
- **WHEN** the Visits list shows a visit of one of Kevin McCallister's pets
- **THEN** its owner column reads "McCallister, Kevin"

#### Scenario: Pet and visit forms
- **WHEN** the user adds or edits a pet or a visit for Kevin McCallister
- **THEN** the owner shown on the form reads "McCallister, Kevin"

#### Scenario: Veterinarians unchanged
- **WHEN** the user opens the Veterinarians list
- **THEN** vets are still written first name first
