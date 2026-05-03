## 1. Backend owner listing API

- [x] 1.1 Change the owner listing backend flow to accept page, size, and supported sort parameters alongside the existing query filter.
- [x] 1.2 Return a paginated owner listing response with a default page size of 10, allowed page sizes of 10 and 20, deterministic sorting, and validation for unsupported sort keys outside Name and City.
- [x] 1.3 Update backend owner API tests to cover default paging, filtered paging, supported Name and City sorting, valid page size 20, and invalid sort or page-size requests.

## 2. Frontend owner search screen

- [x] 2.1 Update the owner service and owner list component state to consume paginated owner results instead of a raw owner array.
- [x] 2.2 Make the owner list state URL-driven by reading and writing query, sort, page, and size through router query parameters.
- [x] 2.3 Add a rows-per-page selector with options 10 and 20, plus sortable Name and City headers and the custom numbered pagination control with first, last, current, previous, next, and midpoint links.
- [x] 2.4 Reset the screen to the first page when the search query, sort, or rows-per-page selection changes and cover URL state, paging behavior, page-size behavior, and sort interactions with component tests.

## 3. Contract and end-to-end alignment

- [x] 3.1 Update `openapi.yaml` to document the paginated owner listing request parameters, allowed page sizes, and response schema.
- [x] 3.2 Update owner end-to-end coverage to assert paginated and sorted owner browsing, numbered pagination, rows-per-page selection, and URL-preserved state against the API-backed UI.
