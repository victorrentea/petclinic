# Implementation Plan: Unified Owner Search

## Overview

Replace the single `lastName` filter with a unified `?q=` search across owner first name, last name, address, city, and pet names. Backend-first: repository → controller → openapi → frontend service → component → UX polish.

## Tasks

- [x] 1. Update OpenAPI spec and regenerate DTOs
  - In `openapi.yaml` (root), replace the `lastName` query parameter on `GET /api/owners` with a `q` parameter (`type: string`, `required: false`, `maxLength: 255`)
  - Run `./mvnw clean install -pl petclinic-backend` to regenerate the `ListOwnersParams` DTO
  - _Requirements: 1.1, 6.3, 7.3, 8.1, 9.2_

- [x] 2. Implement `OwnerRepository.findBySearch`
  - [x] 2.1 Add `findBySearch` JPQL query method to `OwnerRepository`
    - Use `EXISTS` subquery (not JOIN) for pet name matching to avoid cardinality explosion
    - OR across `firstName`, `lastName`, `address`, `city` with `UPPER()/LIKE/CONCAT`
    - Handle null/empty `q` to return all owners
    - Sort: `firstName ASC`, then `lastName ASC`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 7.1, 7.2, 8.1, 8.2, 8.3_

  - [ ]* 2.2 Write property test: Search Completeness
    - **Property 1: Every owner whose firstName, lastName, address, city, or any pet name contains the search term (case-insensitive) MUST appear in results**
    - **Validates: Requirements 1.1, 1.2, 1.3**
    - Use jqwik `@Property` with `@ForAll` owners and search terms; insert via `ownerRepository`, query via `findBySearch`

  - [ ]* 2.3 Write property test: Search Precision
    - **Property 2: Every owner returned MUST match the search term in at least one field or pet name**
    - **Validates: Requirements 1.1, 1.2, 1.3**

  - [ ]* 2.4 Write property test: No Duplicates
    - **Property 3: Each owner appears at most once in results, even when multiple pets match**
    - **Validates: Requirements 8.1**

  - [ ]* 2.5 Write property test: Case Insensitivity
    - **Property 4: `findBySearch("smith")`, `findBySearch("SMITH")`, and `findBySearch("Smith")` return identical result sets**
    - **Validates: Requirements 1.2**

- [x] 3. Update `OwnerRestController.listOwners`
  - Replace `@RequestParam(name = "lastName") String lastName` with `@RequestParam(name = "q", required = false) String q`
  - Trim whitespace; reject (400) if length > 255 after trim
  - Call `ownerRepository.findBySearch(q)` replacing the old `findByLastNameStartingWith` / `findAll` branch
  - Remove `findByLastNameStartingWith` from `OwnerRepository` (no longer needed)
  - _Requirements: 1.1, 7.3, 7.4, 8.1, 9.1, 9.2, 9.3, 9.4_

- [x] 4. Update `OwnerTest` for the new endpoint contract
  - Replace `getAllWithAddressFilter` test (uses `?lastName=`) with tests for `?q=` covering:
    - match by first name, last name, address, city, pet name
    - case-insensitive match
    - empty `q` returns all owners
    - `q` longer than 255 chars returns 400
    - no match returns empty list (not 404)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 7.3, 9.1, 9.3, 9.4_

- [x] 5. Checkpoint — ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Update `owner.service.ts`
  - [x] 6.1 Replace `searchOwners(lastName)` with `getOwners(q?: string): Observable<Owner[]>`
    - Send `GET /api/owners?q=<term>` when `q` is provided, or `GET /api/owners` when omitted
    - _Requirements: 1.1, 9.2_

  - [ ]* 6.2 Update `owner.service.spec.ts`
    - Replace `searchOwners` spy expectations to use `q` parameter
    - Verify `HttpParams` contains `q` when provided, and is absent when not
    - _Requirements: 1.1_

- [x] 7. Rewrite `owner-list.component.ts`
  - [x] 7.1 Replace `lastName` property with `searchText: string = ''`
  - [x] 7.2 Add `private searchSubject = new Subject<string>()`; wire `ngOnInit` to pipe through `debounceTime(400)`, `distinctUntilChanged()`, `switchMap` calling `ownerService.searchOwners(term)`, and `finalize` to clear loading state
  - [x] 7.3 Add `isLoading: boolean = false`; set to `true` before search starts, `false` in `finalize`
  - [x] 7.4 Remove `searchByLastName()` method; add `onSearchInput(value: string)` that pushes to `searchSubject`
  - [x] 7.5 Call `ownerService.getOwners(term || undefined)` for both empty and non-empty terms; on error set `owners = []`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 10.1, 10.2_

- [x] 8. Rewrite `owner-list.component.html`
  - [x] 8.1 Replace the `lastName` input + "Find Owner" button with a single `<input id="search">` bound to `searchText`, placeholder `"Search by name, address, city, telephone, or pet name"`, `maxlength="255"`, firing `(input)="onSearchInput($event.target.value)"`
  - [x] 8.2 Add semi-transparent overlay blocker over the owners grid: `<div class="search-overlay" *ngIf="isLoading">` containing a centered Bootstrap spinner; use `position: absolute` + `z-index` so it sits on top of the table
  - [x] 8.3 Add empty-state block shown when `!isLoading && owners?.length === 0`: display Kiro dead logo (`assets/kiro-dead.svg` or equivalent) and the text `"No results found"`
  - [x] 8.4 Remove the old `*ngIf="!owners"` "No owners with LastName…" message
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4_

- [x] 9. Update `owner-list.component.spec.ts`
  - Replace `searchByLastName` tests with tests for `onSearchInput`:
    - debounce: emitting two values quickly should only trigger one service call
    - `switchMap`: a second emission cancels the first in-flight request
    - empty string calls `getOwners()`, non-empty calls `searchOwners(q)`
    - `isLoading` is `true` during search and `false` after `finalize`
    - error sets `owners` to `[]`
  - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 10.1_

- [x] 10. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked `*` are optional and can be skipped for a faster MVP
- The Gatling perf test at `petclinic-backend/src/test/java/.../gatling/OwnerSearchSimulation.java` already targets `?q=` — no changes needed there
- `findByLastNameStartingWith` is removed as part of task 3 (immediate migration, no deprecation period)
- Property tests use jqwik (already on the classpath per existing tests)
- The overlay blocker (task 8.2) must use CSS `pointer-events: none` on the table beneath it to satisfy requirement 4.3
