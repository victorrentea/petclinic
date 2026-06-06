# visit-vet-association

## ADDED Requirements

### Requirement: Visit records the vet who served it
The system SHALL persist a required reference from a visit to a vet (`visits.vet_id`, `NOT NULL` FK to `vets.id`). A visit MUST NOT be created without a vet.

#### Scenario: Visit created with a vet
- **WHEN** a visit is created with a valid `vetId`
- **THEN** the visit is stored with that vet reference and subsequent reads return it

#### Scenario: Visit creation without a vet is rejected
- **WHEN** a visit creation request omits `vetId`
- **THEN** the request fails with a 400 validation error and no visit is stored

### Requirement: Visit API exposes the vet identity
`VisitDto` SHALL include `vetId`, `vetFirstName`, `vetLastName`. `GET /api/visits` and `GET /api/visits/:id` SHALL populate these fields for every visit.

#### Scenario: Listing visits returns vet fields
- **WHEN** `GET /api/visits` is called
- **THEN** every visit's JSON contains `vetId`, `vetFirstName`, `vetLastName`

### Requirement: Visit create/update requires vetId
`POST /api/visits` and `PUT /api/visits/:id` SHALL require a valid `vetId`; the vet name fields are read-only and SHALL be ignored on input.

#### Scenario: Updating a visit's vet
- **WHEN** `PUT /api/visits/:id` is called with a different valid `vetId`
- **THEN** subsequent reads of that visit return the new vet's id and name

#### Scenario: Update without a vet is rejected
- **WHEN** `PUT /api/visits/:id` is called without `vetId`
- **THEN** the request fails with a 400 validation error and the visit keeps its current vet

### Requirement: MCP visit tools reflect the vet
The MCP `list_visits` tool result SHALL include `vetId`, `vetFirstName`, `vetLastName` per visit. The MCP `create_visit` tool SHALL require a `vetId` referencing an existing vet and SHALL fail with a clear error when it is missing or unknown.

#### Scenario: MCP list_visits includes the vet
- **WHEN** the MCP `list_visits` tool is invoked for an owner whose pet has visits
- **THEN** each returned visit view includes the vet's id, first name, and last name

#### Scenario: MCP create_visit without a vet fails
- **WHEN** the MCP `create_visit` tool is invoked without a `vetId`
- **THEN** the tool returns an error stating the serving vet is required and no visit is created

### Requirement: Existing data backfilled
The migration SHALL deterministically assign a vet to every pre-existing visit before enforcing `NOT NULL`.

#### Scenario: Migrated database has vets on all visits
- **WHEN** migrations run on a database with existing visits
- **THEN** every visit has a non-null `vet_id` referencing an existing vet
