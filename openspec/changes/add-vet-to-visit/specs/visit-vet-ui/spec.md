# visit-vet-ui

## ADDED Requirements

### Requirement: Required vet dropdown in visit add and edit forms
The visit add (`visit-add`) and visit edit (`visit-edit`) forms SHALL include a required vet dropdown populated from `GET /api/vets`, labeled with the vet's first and last name, with NO empty option. The form MUST NOT submit without a selected vet; the selected `vetId` SHALL be submitted with the visit; on edit, the current vet SHALL be preselected.

#### Scenario: Creating a visit requires selecting a vet
- **WHEN** the user fills the add-visit form without selecting a vet
- **THEN** the form is invalid and cannot be submitted until a vet is selected

#### Scenario: Created visit shows the selected vet
- **WHEN** the user selects a vet and submits the add-visit form
- **THEN** the created visit shows that vet wherever the visit is displayed

#### Scenario: Editing preselects the current vet
- **WHEN** the user opens the edit form of a visit
- **THEN** the dropdown shows the visit's current vet selected, and changing it updates the visit on save

### Requirement: Vet displayed on every visit list surface
Every UI surface that renders visit rows SHALL show the serving vet's full name next to the visit. Surfaces: the visits page table (`/visits`, `#visitsTable` — column order Date | Description | Pet | Owner | Vet, cell `td.visit-vet`) and the reusable `visit-list` component (owner detail "Pets and Visits" and visit-add "Previous Visits").

#### Scenario: Visits page shows the vet column
- **WHEN** the user opens `/visits`
- **THEN** each row displays the serving vet's first and last name in the Vet column

#### Scenario: Owner detail shows the vet next to each pet's visit
- **WHEN** the user opens an owner's detail page with pets that have visits
- **THEN** each visit row in the pet's visit list includes the serving vet's name
