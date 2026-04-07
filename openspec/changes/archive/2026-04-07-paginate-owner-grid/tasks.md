## 1. Backend

- [x] 1.1 Update OpenAPI spec (`openapi.yml`) to add `page`, `size(10|20|50)`, `sort`, `q` params
- [x] 1.2 Update OpenAPI response for `/api/owners` to paginated schema (content, number, size, totalElements, totalPages)
- [x] 1.3 Regenerate DTOs from OpenAPI
- [x] 1.4 Update OwnersController to accept page, size, sort, q params
- [x] 1.5 Implement Pageable in service layer
- [x] 1.6 Implement filtering by `q` across relevant fields
- [x] 1.7 Update repository to return Page<Owner>
- [x] 1.8 Map Page<Owner> to DTO including metadata
- [x] 1.9 Ensure stable default sort (id)
- [x] 1.10 Add/adjust tests for pagination + search scenarios

## 2. Frontend

- [x] 2.1 Update owners service to send page, size, sort, q params
- [x] 2.2 Store pagination + search state in component
- [x] 2.3 Sync state with URL query params (page, size, sort, q)
- [x] 2.4 Initialize state from URL on load (deep link support)
- [x] 2.5 Add page size dropdown (10 / 20 / 50)
- [x] 2.6 Display total number of pages
- [x] 2.7 Implement pagination UI:
- [x] 2.8 Show current page with ±2 neighbors
- [x] 2.9 Always show first 3 and last 2 pages
- [x] 2.10 Show middle page indicator when gaps exist
- [x] 2.11 Bind pagination controls to API calls
- [x] 2.12 Add search input bound to `q`
- [x] 2.13 Update/extend component tests for pagination + URL sync

## 3. Integration

- [x] 3.1 Verify end-to-end pagination (page, size, sort, q)
- [x] 3.2 Verify deep link behavior (refresh + shared URL)
- [x] 3.3 Validate performance with large dataset
- [x] 3.4 Ensure backward compatibility (no params still works)
