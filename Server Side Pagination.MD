---
title: Server-side pagination for owner search
version: 1.0
date_created: 2026-02-11
last_updated: 2026-02-11
---
# Implementation Plan: Server-side pagination for owner search
Add server-side pagination for the owners search endpoint, with optional name/address filters, default sort by name ascending, and UI controls for page navigation and size (10/20/50).

## Architecture and design
- REST: extend `GET /api/owners` to accept `page`, `size`, `sort` and return a paged response (items + paging metadata).
- Data access: move owner queries to pageable versions and apply default sort when client omits `sort`.
- UI: owners list reads paging metadata, renders controls, and requests the selected page/size/sort. The table becomes sortable by columns.
- Tests: update REST and Angular tests to the new response shape and pagination behavior.

## Tasks
- [ ] Define paging contract: query params (`page`, `size`, `sort`) and response envelope (`content`, `page`, `size`, `totalElements`, `totalPages`, `sort`).
- [ ] REST: update owner endpoint to accept paging params and return a paged DTO.
- [ ] REST: update `OwnerRepository` to support paging for name/address filters and combined search.
- [ ] REST: apply default sort by name ascending when `sort` is missing.
- [ ] REST tests: update `OwnerTest` to assert pagination metadata and filtered paging results.
- [ ] Angular: extend `OwnerService.getOwners` to accept paging/sorting params and parse the paged response.
- [ ] Angular: update owner list component to track page/size/sort state and request pages.
- [ ] Angular UI: add page controls and size selector (10/20/50), keep existing search UX, and make the table sortable by columns.
- [ ] Angular tests: update owner list tests and service tests for the new response shape and params.

## Open questions
- Should `page` be 0-based or 1-based for the API?
- What exact default sort fields should represent “name asc” (e.g., `lastName,firstName` or a single `lastName`)?
- Do you want to include total counts when filters are empty as well (full dataset), or only when searching?
