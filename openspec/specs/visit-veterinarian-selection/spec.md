## ADDED Requirements

### Requirement: Visit forms require veterinarian selection
The system SHALL require clinic staff to choose an existing veterinarian when creating or editing a visit. The New Visit form and Edit Visit form MUST display a dropdown populated from the veterinarian records that already exist in the clinic and MUST submit the selected veterinarian identifier with the visit.

#### Scenario: New Visit loads available veterinarians
- **WHEN** a staff member opens the New Visit screen
- **THEN** the form shows a veterinarian dropdown containing the veterinarians already defined in the clinic

#### Scenario: Visit is created with selected veterinarian
- **WHEN** a staff member submits a valid New Visit form with a veterinarian selected
- **THEN** the visit is persisted with that veterinarian assignment

#### Scenario: Edit Visit preselects current veterinarian
- **WHEN** a staff member opens the Edit Visit screen for an existing visit
- **THEN** the veterinarian dropdown is populated with the clinic's existing veterinarians and the visit's current veterinarian is preselected

#### Scenario: Visit veterinarian can be changed on edit
- **WHEN** a staff member submits a valid Edit Visit form with a different veterinarian selected
- **THEN** the visit is updated with the new veterinarian assignment

### Requirement: Visit views display veterinarian identity
The system SHALL expose the assigned veterinarian for each visit and MUST render that information anywhere the application displays visit rows for a pet or owner, including the main visits grid and the previous visits component shown from pet and New Visit flows.

#### Scenario: Visits grid shows veterinarian name
- **WHEN** a staff member views the global visits grid
- **THEN** each visit row includes the assigned veterinarian name alongside the existing visit data

#### Scenario: Pet visit history shows veterinarian name
- **WHEN** a staff member views the visit history for a pet from the owner detail or New Visit screen
- **THEN** each visit row includes the assigned veterinarian name

### Requirement: Legacy visits remain readable
The system SHALL continue to display visits created before veterinarian assignment was introduced. If a visit has no assigned veterinarian, the UI MUST show `Unassigned` anywhere veterinarian identity is rendered.

#### Scenario: Legacy visit without veterinarian is displayed
- **WHEN** a staff member opens a visit list or detail containing a visit with no assigned veterinarian
- **THEN** the veterinarian field is rendered as `Unassigned`
