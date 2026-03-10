# Requirements: Unified Owner Search

## Overview
Replace the current dual-field owner search interface (separate name and address fields) with a single unified search field that searches across owner name, address, and city using OR logic.

## User Stories

### US1: Single Search Field
**As a** clinic staff member  
**I want** a single search field for finding owners  
**So that** I can quickly search without deciding which field to use

**Acceptance Criteria:**
- AC1.1: The owner screen displays one search input field instead of two separate fields
- AC1.2: The search field has a clear placeholder indicating it searches across multiple fields (e.g., "Search by name, address, or city")
- AC1.3: The search field is prominently positioned and easily accessible

### US2: Multi-Field Search with OR Logic
**As a** clinic staff member  
**I want** my search query to match owners by name, address, or city  
**So that** I can find owners regardless of which information I remember

**Acceptance Criteria:**
- AC2.1: Entering text matches owners where the name contains the search text (case-insensitive)
- AC2.2: Entering text matches owners where the address contains the search text (case-insensitive)
- AC2.3: Entering text matches owners where the city contains the search text (case-insensitive)
- AC2.4: Results include owners matching ANY of the three criteria (OR logic)
- AC2.5: No duplicate owners appear in results even if they match multiple criteria

### US3: Search Results Display
**As a** clinic staff member  
**I want** to see all matching owners in a grid  
**So that** I can select the owner I'm looking for

**Acceptance Criteria:**
- AC3.1: The existing owner grid displays all matching results
- AC3.2: Results update as the user types (if current behavior supports this) or on submit
- AC3.3: Empty search shows all owners (or appropriate default behavior)
- AC3.4: No results found shows appropriate feedback message

## Correctness Properties

### CP1: Search Completeness
**Property:** For any owner O and search text T, if T is a substring of O's name, address, or city (case-insensitive), then O must appear in the search results.

**Rationale:** Ensures no valid matches are missed.

### CP2: Search Precision  
**Property:** For any owner O in search results for text T, T must be a substring of at least one of: O's name, O's address, or O's city (case-insensitive).

**Rationale:** Ensures no irrelevant results are returned.

### CP3: No Duplicates
**Property:** For any search text T, each owner appears at most once in the results, regardless of how many fields match.

**Rationale:** Prevents confusion and maintains clean UI.

### CP4: Case Insensitivity
**Property:** For any search text T and owner O, the match result is identical for T, T.toLowerCase(), and T.toUpperCase().

**Rationale:** Users shouldn't need to worry about capitalization.

## Non-Functional Requirements

### NFR1: Performance
- Search should complete within 500ms for databases with up to 10,000 owners
- UI should remain responsive during search

### NFR2: Usability
- Search field should be intuitive and require no training
- Placeholder text should clearly indicate multi-field search capability

### NFR3: Backward Compatibility
- Existing owner data structure should not require migration
- API changes should maintain backward compatibility if possible

## Out of Scope
- Advanced search operators (AND, NOT, exact match)
- Search history or saved searches
- Fuzzy matching or typo tolerance
- Search across pet information or other related entities
