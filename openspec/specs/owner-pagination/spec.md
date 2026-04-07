## ADDED Requirements

### Requirement: Paginated owners retrieval
The system SHALL return owners in paginated form using `page`, `size`, and `sort` parameters.

#### Scenario: Default pagination
- **WHEN** client calls `/api/owners` without parameters
- **THEN** system returns first page with default size and sorted by lastName,id

#### Scenario: Specific page requested
- **WHEN** client calls `/api/owners?page=2&size=10`
- **THEN** system returns page 2 with 10 owners and metadata (totalElements, totalPages)

### Requirement: Pagination metadata
The system SHALL include pagination metadata in responses.

#### Scenario: Metadata present
- **WHEN** a paginated response is returned
- **THEN** response contains `content`, `totalElements`, `totalPages`, and `number`
