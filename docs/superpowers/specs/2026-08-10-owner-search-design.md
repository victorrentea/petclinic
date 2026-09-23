# Owner Search Improvement Design (BE + FE)

## Goal
Improve owner search so filtering works across any visible Owners table column content, using case-insensitive `contains` semantics.

## Scope
- Backend owner listing/search endpoint
- Frontend owners list search flow and empty-state text
- Automated tests in backend and frontend for new behavior

## Requirements
1. Search must match across visible columns:
   - Owner full name (`firstName + " " + lastName`)
   - Address
   - City
   - Telephone
   - Pet names
2. Matching must be:
   - Case-insensitive
   - `contains`-based (not prefix-only)
3. Keep backward compatibility:
   - Existing `lastName` query parameter continues to work
   - Add new general search parameter (`q`)

## API Design
### Endpoint
`GET /api/owners`

### Query parameters
- `lastName` (existing): prefix-based behavior preserved
- `q` (new): case-insensitive contains across visible columns

### Resolution rules
- If `q` is non-blank, backend applies broad search behavior and ignores `lastName` for filtering.
- If `q` is blank or missing, backend uses existing `lastName` prefix behavior.

## Backend Design
1. Extend [OwnerRestController](/Users/kochumani/Documents/Victor-Agentic-Engineering/petclinic.worktrees/improve-owner-search-filtering/petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java) to accept optional `q`.
2. Extend [OwnerRepository](/Users/kochumani/Documents/Victor-Agentic-Engineering/petclinic.worktrees/improve-owner-search-filtering/petclinic-backend/src/main/java/victor/training/petclinic/repository/OwnerRepository.java) with a JPQL query method that:
   - Left-joins pets
   - Uses `LOWER(...) LIKE` for all searched fields
   - Uses `DISTINCT` to prevent duplicate owners from pet joins
3. Keep existing last-name prefix repository method unchanged.

## Frontend Design
1. Keep Owners page single search input and button.
2. Update [OwnerService](/Users/kochumani/Documents/Victor-Agentic-Engineering/petclinic.worktrees/improve-owner-search-filtering/petclinic-frontend/src/app/owners/owner.service.ts):
   - Add a method for broad search with `q`
   - Keep existing `searchOwners(lastName)` unchanged for compatibility
3. Update [OwnerListComponent](/Users/kochumani/Documents/Victor-Agentic-Engineering/petclinic.worktrees/improve-owner-search-filtering/petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts):
   - Route non-empty search text to new broad-search API path
   - Keep empty input behavior as full list fetch
4. Update [owner-list.component.html](/Users/kochumani/Documents/Victor-Agentic-Engineering/petclinic.worktrees/improve-owner-search-filtering/petclinic-frontend/src/app/owners/owner-list/owner-list.component.html) empty-state message to describe general search instead of last-name prefix.

## Error Handling
- Preserve existing error handling patterns:
  - Backend: existing exception handling mechanism
  - Frontend: existing `catchError`/component assignment patterns
- No silent behavior changes for API errors.

## Testing Strategy
### Backend tests
In [OwnerTest](/Users/kochumani/Documents/Victor-Agentic-Engineering/petclinic.worktrees/improve-owner-search-filtering/petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerTest.java):
- Add tests for `q` matching by:
  - Name fragment
  - Address fragment
  - City fragment
  - Telephone fragment
  - Pet-name fragment
- Add case-insensitive verification.
- Keep current `lastName` tests green.

### Frontend tests
- [owner.service.spec.ts](/Users/kochumani/Documents/Victor-Agentic-Engineering/petclinic.worktrees/improve-owner-search-filtering/petclinic-frontend/src/app/owners/owner.service.spec.ts):
  - Verify request URL for `q` query parameter.
- [owner-list.component.spec.ts](/Users/kochumani/Documents/Victor-Agentic-Engineering/petclinic.worktrees/improve-owner-search-filtering/petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts):
  - Verify non-empty input uses broad search API path.
  - Preserve existing empty-input behavior assertion.

## Out of Scope
- Pagination changes
- Sorting changes
- UI layout redesign
- API contract changes outside owners search parameters
