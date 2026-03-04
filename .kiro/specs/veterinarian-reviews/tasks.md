# Implementation Plan: Veterinarian Reviews

## Overview

This implementation plan breaks down the veterinarian review feature into incremental coding tasks. The feature includes both backend (Spring Boot with Java) and frontend (Angular with TypeScript) implementation. The backend uses OWASP Java HTML Sanitizer for XSS protection. The implementation follows a bottom-up approach: backend data layer → backend API → frontend data models → frontend services → frontend components → integration.

## Tasks

- [ ] 1. Set up backend database schema
  - [x] 1.1 Create database migration for reviews table
    - Create SQL migration file with reviews table definition
    - Add columns: id, vet_id, rating, feedback, created_at
    - Add foreign key constraint to vets table with CASCADE delete
    - Add indexes on vet_id and created_at
    - Add CHECK constraint for rating (1-5)
    - _Requirements: 1.2, 1.3, 1.4, 4.1, 4.2, 4.4_

- [ ] 2. Implement backend entity and repository
  - [x] 2.1 Create Review JPA entity
    - Create Review.java with JPA annotations (@Entity, @Table, @Id, @GeneratedValue)
    - Add fields: id, vet (ManyToOne), rating, feedback, createdAt
    - Add Jakarta validation annotations (@NotNull, @Min, @Max, @Size)
    - Add @PrePersist method to set createdAt timestamp
    - _Requirements: 1.2, 1.3, 1.4, 4.1, 4.2, 4.4_
  
  - [x] 2.2 Create ReviewRepository interface
    - Create ReviewRepository.java extending Spring Data Repository
    - Add custom query methods: findByVetIdOrderByCreatedAtDesc, findMostRecentByVetId
    - Add aggregation queries: findAverageRatingByVetId, countByVetId
    - _Requirements: 2.1, 2.4, 2.7, 2.9_
  
  - [ ]* 2.3 Write repository tests
    - Test custom queries with H2 in-memory database
    - Test sorting and filtering logic
    - Test aggregation queries (average rating, count)
    - _Requirements: 2.1, 2.4, 2.7, 2.9_

- [ ] 3. Implement backend DTOs and mapper
  - [x] 3.1 Create Review DTOs
    - Create ReviewDto.java with all fields including id and createdAt
    - Create ReviewFieldsDto.java for submission (no id or createdAt)
    - Create ReviewStatsDto.java for aggregated statistics
    - Add Jakarta validation annotations and Swagger documentation
    - _Requirements: 1.2, 1.3, 2.4, 4.1, 4.2_
  
  - [x] 3.2 Create ReviewMapper interface
    - Create ReviewMapper.java using MapStruct (@Mapper annotation)
    - Add mapping methods: toReviewDto, toReview, toReviewDtos
    - Configure field mappings for vet.id to vetId
    - _Requirements: 1.4_
  
  - [ ]* 3.3 Write mapper tests
    - Test entity-to-DTO and DTO-to-entity conversion
    - Verify field mapping correctness
    - Test null handling
    - _Requirements: 1.4_

- [ ] 4. Add OWASP Java HTML Sanitizer dependency
  - [x] 4.1 Update pom.xml with OWASP sanitizer dependency
    - Add dependency: com.googlecode.owasp-java-html-sanitizer:owasp-java-html-sanitizer:20220608.1
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

- [ ] 5. Implement backend service layer with sanitization
  - [x] 5.1 Create ReviewService with OWASP sanitization
    - Create ReviewService.java with @Service annotation
    - Implement sanitizeFeedback() method using OWASP Java HTML Sanitizer
    - Implement sanitizeAndSave() method that sanitizes before saving
    - Implement getReviewsByVetId(), getReviewStats(), deleteReview() methods
    - Configure OWASP sanitizer to strip all HTML tags (plain text only policy)
    - _Requirements: 1.4, 1.5, 2.1, 2.4, 2.7, 6.1, 6.2, 6.3, 6.5_
  
  - [x] 5.2 Write property test for XSS input sanitization
    - **Property 17: XSS input sanitization**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.5**
    - Use JUnit parameterized tests to test various malicious inputs with HTML tags, script tags, and special characters
    - Verify OWASP sanitizer removes all malicious content
    - Test multiple attack vectors
  
  - [ ]* 5.3 Write unit tests for ReviewService sanitization
    - Test specific malicious inputs: `<script>alert('xss')</script>`, `<img onerror="alert('xss')">`
    - Test HTML tag removal: `<b>text</b>` becomes `text`
    - Test event handler removal: `<div onclick="alert(1)">` is stripped
    - Test plain text preservation
    - Mock ReviewRepository for isolated testing
    - _Requirements: 6.1, 6.2, 6.3, 6.5_
  
  - [ ]* 5.4 Write unit tests for ReviewService business logic
    - Test getReviewStats() calculation logic
    - Test review retrieval and sorting
    - Mock ReviewRepository for isolated testing
    - _Requirements: 2.1, 2.4, 2.7_

- [ ] 6. Implement backend REST controller
  - [x] 6.1 Create ReviewRestController
    - Create ReviewRestController.java with @RestController and @RequestMapping
    - Implement GET /api/vets/{vetId}/reviews endpoint
    - Implement GET /api/vets/{vetId}/reviews/stats endpoint
    - Implement POST /api/vets/{vetId}/reviews endpoint with @Validated
    - Implement DELETE /api/vets/{vetId}/reviews/{reviewId} endpoint
    - Add proper HTTP status codes and Location header for POST
    - Inject ReviewService, ReviewMapper, and VetRepository
    - _Requirements: 1.1, 1.4, 1.5, 2.1, 2.4, 2.6, 2.7, 4.3_
  
  - [ ]* 6.2 Write controller unit tests
    - Test request validation using MockMvc
    - Verify response status codes and headers
    - Test error handling and exception mapping
    - Mock ReviewService and VetRepository
    - _Requirements: 1.5, 4.3_
  
  - [ ]* 6.3 Write backend integration tests
    - Test full request-response cycle with TestRestTemplate
    - Verify database persistence with actual database
    - Test transaction boundaries
    - Test cascade delete behavior
    - Test rating validation (Property 1)
    - Test feedback length validation (Property 2)
    - Test reverse chronological sorting (Property 12)
    - _Requirements: 1.2, 1.3, 1.4, 2.9, 4.1, 4.2_

- [x] 7. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Set up frontend data models and interfaces
  - [x] 8.1 Create review data model interfaces
    - Create `review.model.ts` with Review, ReviewSubmission, and ReviewStats interfaces
    - Define all required fields with proper TypeScript types matching backend DTOs
    - _Requirements: 1.2, 1.3, 1.4, 2.4, 4.1, 4.2, 4.4_

- [ ] 9. Implement frontend sanitization service for XSS protection
  - [x] 9.1 Create SanitizationService with input sanitization methods
    - Implement `sanitizeFeedback()`, `removeHtmlTags()`, `escapeSpecialCharacters()`, and `validateNoScriptTags()` methods
    - Use Angular's DomSanitizer and regex for HTML tag removal
    - Note: This provides defense-in-depth; backend OWASP sanitizer is primary protection
    - _Requirements: 6.1, 6.2, 6.3, 6.5_
  
  - [ ]* 9.2 Write property test for frontend XSS input sanitization
    - Generate random strings with HTML tags, script tags, and special characters
    - Verify all malicious content is removed or escaped
    - Use fast-check with minimum 100 iterations
  
  - [ ]* 9.3 Write unit tests for SanitizationService
    - Test specific malicious inputs: `<script>alert('xss')</script>`, `<img onerror="alert('xss')">`
    - Test special character escaping: <, >, &, ", '
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

- [ ] 10. Implement ReviewService for API communication
  - [x] 10.1 Create ReviewService with HTTP methods
    - Implement `getReviewsByVetId()`, `getReviewStats()`, `submitReview()`, and `deleteReview()` methods
    - Configure API endpoints: GET/POST /api/vets/{vetId}/reviews, GET /api/vets/{vetId}/reviews/stats
    - Add error handling for network and server errors
    - _Requirements: 1.4, 1.5, 2.1, 2.7, 4.3_
  
  - [ ]* 10.2 Write unit tests for ReviewService
    - Test HTTP error handling (400, 404, 500)
    - Test response parsing and API endpoint construction
    - Mock HttpClient for isolated testing
    - _Requirements: 1.4, 1.5, 4.3_

- [x] 11. Checkpoint - Ensure all frontend service tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Implement VetReviewFormComponent
  - [x] 12.1 Create form component with template and validation logic
    - Create component with star rating selector, textarea with character counter (500 max), submit/cancel buttons
    - Implement `submitReview()`, `validateRating()`, and `validateFeedback()` methods
    - Integrate SanitizationService for input validation
    - Display error messages inline and success confirmation
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 3.2, 4.1, 4.2, 4.3, 4.4_
  
  - [ ]* 12.2 Write property test for rating validation
    - **Property 1: Rating validation**
    - **Validates: Requirements 1.2, 1.6, 4.1**
    - Generate random integers (negatives, zero, >5) and non-integers (floats, strings, null)
    - Verify only integers 1-5 are accepted
    - Use fast-check with minimum 100 iterations
  
  - [ ]* 12.3 Write property test for feedback length validation
    - **Property 2: Feedback length validation**
    - **Validates: Requirements 1.3, 4.2**
    - Generate random strings of varying lengths (0-1000 chars)
    - Verify feedback ≤500 chars accepted, >500 chars rejected
    - Use fast-check with minimum 100 iterations
  
  - [ ]* 12.4 Write property test for review-veterinarian association
    - **Property 3: Review-veterinarian association**
    - **Validates: Requirements 1.4, 3.2**
    - Generate random vet IDs and verify saved reviews contain correct vetId
    - Use fast-check with minimum 100 iterations
  
  - [ ]* 12.5 Write unit tests for VetReviewFormComponent
    - Test form initialization, button states, error display
    - Test edge cases: empty feedback, exactly 500 characters
    - Test form submission flow with mocked ReviewService
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 4.3_

- [ ] 13. Implement VetReviewPreviewComponent
  - [x] 13.1 Create preview component for veterinarian list
    - Create component with inputs for vetId and reviewStats
    - Implement `renderStars()` method
    - Display average rating with stars and "View Reviews" link
    - Handle empty state with "No reviews available" message
    - _Requirements: 2.1, 2.2, 5.1, 5.3_
  
  - [ ]* 13.2 Write unit tests for VetReviewPreviewComponent
    - Test empty state display
    - Test star rendering for different rating values
    - _Requirements: 2.1, 5.1_

- [ ] 14. Implement VetReviewDetailsComponent
  - [x] 14.1 Create review details page component
    - Create component that loads reviews from route parameter (vetId)
    - Implement `loadReviews()` and `sortReviewsByDate()` methods
    - Display veterinarian info header, list of all reviews with full text, star ratings, timestamps
    - Add back navigation button
    - Use Angular's DomSanitizer to render feedback as plain text
    - _Requirements: 2.6, 2.7, 2.8, 2.9, 5.1, 5.2, 6.4_
  
  - [ ]* 14.2 Write property test for complete review display
    - **Property 11: Complete review display**
    - **Validates: Requirements 2.7, 2.8**
    - Generate random review sets and verify all reviews displayed with complete data
    - Use fast-check with minimum 100 iterations
  
  - [ ]* 14.3 Write property test for reverse chronological sorting
    - **Property 12: Reverse chronological sorting**
    - **Validates: Requirements 2.9**
    - Generate random review arrays with random timestamps
    - Verify reviews sorted by createdAt descending (most recent first)
    - Use fast-check with minimum 100 iterations
  
  - [ ]* 14.4 Write property test for XSS output protection
    - **Property 18: XSS output protection**
    - **Validates: Requirements 6.4**
    - Generate stored reviews with potentially malicious content
    - Verify rendered output treats text as plain text (no script execution)
    - Use fast-check with minimum 100 iterations
  
  - [ ]* 14.5 Write unit tests for VetReviewDetailsComponent
    - Test empty review list display
    - Test single review display
    - Test navigation and route parameter handling
    - Test line break preservation in feedback
    - _Requirements: 2.6, 2.7, 2.8, 2.9, 5.2_

- [x] 15. Checkpoint - Ensure all component tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Add routing for review details page
  - [x] 16.1 Update vets-routing.module.ts with review details route
    - Add route `/vets/:id/reviews` pointing to VetReviewDetailsComponent
    - Configure route parameters for vetId
    - _Requirements: 2.6_
  
  - [ ]* 16.2 Write property test for review details navigation
    - **Property 10: Review details navigation**
    - **Validates: Requirements 2.6**
    - Generate random vet IDs and verify clicking "View Reviews" navigates to correct route
    - Use fast-check with minimum 100 iterations

- [ ] 17. Integrate components into veterinarian list
  - [x] 17.1 Add VetReviewPreviewComponent to veterinarian list template
    - Update vets list component to include review preview for each vet
    - Pass vetId and reviewStats as inputs
    - Load review stats from backend API
    - _Requirements: 2.1, 5.1, 5.3_
  
  - [x] 17.2 Add submit review button to veterinarian list
    - Add button that opens VetReviewFormComponent (modal or inline)
    - Ensure button is visible at all times
    - Wire up reviewSubmitted event to refresh review data
    - _Requirements: 1.1, 3.1, 3.3_
  
  - [ ]* 17.3 Write property test for form display on button click
    - **Property 4: Form display on button click**
    - **Validates: Requirements 1.1**
    - Verify clicking submit review button displays the review form
    - Use fast-check with minimum 100 iterations
  
  - [ ]* 17.4 Write property test for required UI elements present
    - **Property 13: Required UI elements present**
    - **Validates: Requirements 2.5, 3.1, 3.3**
    - Verify "View Reviews" link and submit review button are visible for each vet
    - Use fast-check with minimum 100 iterations
  
  - [ ]* 17.5 Write integration tests for complete review flow
    - Test form submission flow: user input → validation → service call → success message
    - Test navigation flow: vet list → click View Reviews → details page loads
    - Test error flow: invalid input → error display → correction → successful submission
    - _Requirements: 1.1, 1.5, 2.6, 4.3_

- [x] 18. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Backend uses Java with Spring Boot and OWASP Java HTML Sanitizer for XSS protection
- Frontend uses Angular with TypeScript
- Backend property tests use JUnit 5 parameterized tests
- Frontend property tests use fast-check library with minimum 100 iterations
- Unit tests use JUnit 5/Mockito (backend) and Jasmine/Karma (frontend)
- Integration tests use Spring Boot Test with TestRestTemplate (backend)
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Backend implementation comes first to provide API for frontend integration
