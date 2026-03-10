# Implementation Plan: Unified Owner Search

## Overview

Replace the dual-field owner search (name and address) with a single unified search field that searches across owner name, address, and city using OR logic. Implementation follows a backend-first approach to ensure API is ready before frontend changes.

## Tasks

- [ ] 1. Implement backend search functionality
  - [x] 1.1 Add findBySearch method to OwnerRepository
    - Create JPQL query with OR conditions across firstName, lastName, address, and city
    - Handle null/empty search to return all owners
    - Use UPPER() for case-insensitive matching with LIKE and CONCAT
    - _Requirements: AC2.1, AC2.2, AC2.3, AC2.4, AC2.5_
  
  - [x] 1.2 Remove deprecated findByNameAndAddress method from OwnerRepository
    - Delete the old findByNameAndAddress method
    - _Requirements: Cleanup for immediate migration_
  
  - [x] 1.3 Write property test for search completeness
    - **Property CP1: Search Completeness**
    - **Validates: Requirements AC2.1, AC2.2, AC2.3, AC2.4**
    - Generate random owners and search terms, verify all matching owners are returned
  
  - [~] 1.4 Write property test for search precision
    - **Property CP2: Search Precision**
    - **Validates: Requirements AC2.1, AC2.2, AC2.3**
    - Verify all returned owners contain the search term in at least one field
  
  - [~] 1.5 Write property test for no duplicates
    - **Property CP3: No Duplicates**
    - **Validates: Requirements AC2.5**
    - Verify each owner appears at most once regardless of multiple field matches
  
  - [~] 1.6 Write property test for case insensitivity
    - **Property CP4: Case Insensitivity**
    - **Validates: Requirements AC2.1, AC2.2, AC2.3**
    - Verify search results are identical for lowercase, uppercase, and mixed case

- [ ] 2. Update REST controller to support unified search
  - [~] 2.1 Modify OwnerRestController.listOwners method
    - Add @RequestParam for search parameter (required = false)
    - Call ownerRepository.findBySearch with normalized search term
    - Map results to OwnerDto using ownerMapper
    - _Requirements: AC2.1, AC2.2, AC2.3, AC2.4_
  
  - [~] 2.2 Write integration tests for REST endpoint
    - Test search with various terms matching different fields
    - Test empty search returns all owners
    - Test case insensitivity
    - Test pagination with search results
    - _Requirements: AC2.1, AC2.2, AC2.3, AC2.4, AC3.3_

- [ ] 3. Checkpoint - Ensure backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Update frontend component template
  - [~] 4.1 Replace dual search fields with single unified field in owner-list.component.html
    - Remove separate name and address input fields
    - Add single search input with id="search"
    - Set placeholder to "Search by name, address, or city"
    - Bind to searchText with [(ngModel)]
    - Wire up (input), (blur), and (keyup.enter) events
    - _Requirements: AC1.1, AC1.2, AC1.3_

- [ ] 5. Update frontend component TypeScript
  - [~] 5.1 Modify owner-list.component.ts
    - Remove name and address properties
    - Add searchText property
    - Update loadOwners() to pass search parameter instead of name/address
    - Ensure normalizeSearchTerm handles the unified search text
    - _Requirements: AC2.1, AC2.2, AC2.3, AC2.4_
  
  - [~] 5.2 Update owner.service.ts
    - Modify getOwners() method signature to accept search parameter
    - Remove name and address parameters
    - Set 'search' query parameter in HttpParams
    - _Requirements: AC2.1, AC2.2, AC2.3, AC2.4_
  
  - [~] 5.3 Write unit tests for component
    - Test searchText binding and updates
    - Test loadOwners calls service with correct search parameter
    - Test empty search behavior
    - _Requirements: AC1.1, AC2.4, AC3.3_

- [ ] 6. Update frontend to display search results
  - [~] 6.1 Ensure owner grid displays all matching results
    - Verify existing grid component handles new search results correctly
    - Ensure results update appropriately (on input/submit based on current behavior)
    - _Requirements: AC3.1, AC3.2_
  
  - [~] 6.2 Add appropriate feedback for empty results
    - Display "No owners found" message when search returns no results
    - Ensure message is user-friendly and clearly visible
    - _Requirements: AC3.4_
  
  - [~] 6.3 Write end-to-end tests for search UI
    - Test typing in search field updates results
    - Test empty search shows all owners
    - Test no results shows appropriate message
    - Test search across different fields (name, address, city)
    - _Requirements: AC1.1, AC1.2, AC2.1, AC2.2, AC2.3, AC3.1, AC3.2, AC3.3, AC3.4_
## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Backend implementation comes first to ensure API is ready for frontend
- Property-based tests validate universal correctness properties from requirements
- Integration tests ensure end-to-end functionality works correctly
- Immediate migration approach: old method removed, no backward compatibility period
- Backend implementation comes first to ensure API is ready for frontend
- Property-based tests validate universal correctness properties from requirements
- Integration tests ensure end-to-end functionality works correctly
- Backward compatibility is maintained by keeping old parameters deprecated (not implemented in these tasks)
