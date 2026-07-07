## 1. Backend paging and sorting contract

- [x] 1.1 Add backend tests covering default paging, supported page sizes, sortable fields, invalid query normalization, and filtered result paging/sorting.
- [x] 1.2 Add a paged Owners list response DTO and request parameter handling for last-name filter, page, page size, sort field, and sort direction.
- [x] 1.3 Implement repository-backed server-side filtering, pagination, and allowlisted sorting, including `name` mapping to `lastName` then `firstName`.

## 2. Frontend Owners grid behavior

- [x] 2.1 Update the Owners API client and model types to consume the paged Owners response.
- [x] 2.2 Refactor the Owners list component to derive filter, page, page size, and sort from URL query params and to normalize invalid state.
- [x] 2.3 Update the Owners grid template to render `Last name First name`, expose sortable headers for Name and City, keep Address, Telephone, and Pets non-sortable, and show the empty-state without grid rows or paginator controls when no owners match.

## 3. End-to-end verification

- [x] 3.1 Add or update frontend tests for URL-driven state, page reset behavior, empty results, and sort toggling.
- [x] 3.2 Add or update integration tests to verify the full Owners directory flow across filtering, sorting, pagination, and out-of-range page handling.
- [x] 3.3 Regenerate any affected API artifacts and ensure the changed backend and frontend test suites pass.
