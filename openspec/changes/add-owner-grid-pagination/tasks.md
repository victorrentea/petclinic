## 1. Backend paging and sorting contract

- [x] 1.1 Update `GET /api/owners` to accept `lastName`, `page`, `size`, and `sort` and return Spring page JSON.
- [x] 1.2 Extend the owners repository to execute last-name prefix filtering with `Pageable` support and stable default ordering.
- [x] 1.3 Update backend REST tests for paged responses, supported sorting, unsupported Pets sorting, and filter-plus-page behavior.

## 2. Generated API artifacts

- [x] 2.1 Update the OpenAPI annotations/examples for the paged owners response and query parameters.
- [x] 2.2 Regenerate `openapi.yaml` and frontend generated API types so the new owners contract is reflected consistently.

## 3. Frontend owners grid behavior

- [x] 3.1 Refactor the owners service and models to consume paged owners data instead of `Owner[]`.
- [x] 3.2 Update the Owners list component to track last-name filter, page index, page size, total count, and active sort state.
- [x] 3.3 Update the Owners grid template to show last name first, enable sorting on Name/Address/City/Telephone, and keep Pets visible but non-sortable.
- [x] 3.4 Reset the grid to the first page whenever the filter, page size, or active sort changes.

## 4. Frontend verification

- [x] 4.1 Update Owners frontend unit tests for the paged API contract, name rendering, sorting interactions, and page reset behavior.
- [x] 4.2 Verify the Owners page works end-to-end against the updated backend contract.
