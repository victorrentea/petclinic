# Requirements Document

## Introduction

The owners screen currently loads all owners in a single request and renders them in one flat table.
As the number of owners grows, this degrades both backend performance and frontend usability.
This feature adds server-side pagination to the `GET /api/owners` endpoint and a matching
pagination control to the Angular owners-list screen, so users can navigate through owners
page by page. The existing unified search filter must continue to work alongside pagination.

## Glossary

- **API**: The REST backend running at `http://localhost:8080/api/`.
- **Backend**: The Spring Boot 3.5 / Java 21 application in `petclinic-backend/`.
- **Frontend**: The Angular 16 application in `petclinic-frontend/`.
- **Owner**: A pet owner entity exposed by the API as `OwnerDto`.
- **Page**: A fixed-size, ordered subset of the full owners collection returned by the API.
- **Page_Number**: A zero-based integer identifying which page is requested (first page = 0).
- **Page_Size**: The number of owners returned per page; user-selectable from 10, 20, or 50 (default: 10).
- **Total_Elements**: The total count of owners matching the current filter, across all pages.
- **Total_Pages**: The total number of pages, equal to `ceil(Total_Elements / Page_Size)`.
- **PagedOwners**: The API response envelope containing a page of owners plus pagination metadata.
- **Owners_List**: The Angular component that displays the owners table (`OwnerListComponent`).
- **Pagination_Control**: The UI widget that shows the current page and allows navigation.
- **Search_Filter**: The optional `lastName` query parameter that performs a case-insensitive substring match across owner last name, address, city, telephone, and pet name.

---

## Requirements

### Requirement 1: Paginated Owner List Endpoint

**User Story:** As a backend developer, I want the `GET /api/owners` endpoint to support
pagination parameters, so that clients can retrieve owners in manageable pages instead of
all at once.

#### Acceptance Criteria

1. WHEN a client calls `GET /api/owners` with query parameters `page` (integer, zero-based)
   and `size` (integer, positive), THE API SHALL return a `PagedOwners` response containing
   the owners for the requested page, the `Total_Elements` count, and the `Total_Pages` count.

2. WHEN a client calls `GET /api/owners` without `page` or `size` parameters,
   THE API SHALL default `page` to `0` and `size` to `10`.

3. WHEN a client calls `GET /api/owners` with a `lastName` filter and pagination parameters,
   THE API SHALL perform a case-insensitive substring match against owner last name, address,
   city, telephone, and pet name before computing pagination, so that `Total_Elements`
   reflects only owners matching the filter value across those fields.

4. WHEN a client requests a `page` value greater than or equal to `Total_Pages`,
   THE API SHALL return an empty `owners` list with correct `Total_Elements` and `Total_Pages`
   values.

5. IF a client supplies a `size` value less than `1` or greater than `100`,
   THEN THE API SHALL return HTTP 400 with a descriptive error message.

6. IF a client supplies a `page` value less than `0`,
   THEN THE API SHALL return HTTP 400 with a descriptive error message.

7. THE API SHALL sort the returned owners by the concatenated full name string
   `firstName + " " + lastName` ascending (the same string displayed in the UI),
   so that the on-screen order matches a natural alphabetical scan by the user.
   Example: "Alice Davis", "Betty Davis", "George Franklin", "Mary Smith" — not
   "Alice Davis", "George Franklin", "Betty Davis", "Mary Smith".

---

### Requirement 2: PagedOwners Response Contract

**User Story:** As a frontend developer, I want a well-defined response envelope for paginated
owner results, so that the Angular client can render the table and pagination control without
additional API calls.

#### Acceptance Criteria

1. THE API SHALL include the following fields in every `PagedOwners` response:
   - `owners`: array of `OwnerDto` objects for the current page
   - `totalElements`: integer — total number of matching owners
   - `totalPages`: integer — total number of pages
   - `currentPage`: integer — the zero-based page number that was returned

2. WHEN the `owners` array is empty (no matching owners), THE API SHALL still return
   `totalElements: 0`, `totalPages: 0`, and `currentPage` equal to the requested page.

3. THE API SHALL update the `openapi.yaml` contract to reflect the new `PagedOwners` schema
   and the updated `GET /api/owners` parameters and response type.

---

### Requirement 3: Frontend Pagination Control

**User Story:** As a clinic user, I want to navigate through owners page by page on the
owners screen, so that the page loads quickly and I can find owners without scrolling through
a long list.

#### Acceptance Criteria

1. WHEN the owners screen loads, THE Owners_List SHALL request page `0` with the default
   `Page_Size` of `10` and display the returned owners in the existing table.

2. THE Owners_List SHALL render a Pagination_Control below the owners table that shows:
   - the current page number (displayed as 1-based to the user)
   - the total number of pages
   - a "Previous" button disabled on the first page
   - a "Next" button disabled on the last page
   - numbered page buttons for direct navigation to a specific page

3. WHEN the user clicks a numbered page button, THE Owners_List SHALL request that page
   from the API and replace the table contents with the new page's owners.

4. WHEN the user clicks "Next", THE Owners_List SHALL request the next page from the API
   and replace the table contents with the new page's owners.

5. WHEN the user clicks "Previous", THE Owners_List SHALL request the previous page from
   the API and replace the table contents with the new page's owners.

6. THE Owners_List SHALL render a page-size selector that allows the user to choose a
   `Page_Size` of `10`, `20`, or `50`.

7. WHEN the user selects a new `Page_Size`, THE Owners_List SHALL reset `Page_Number` to
   `0` and reload the owner list using the newly selected `Page_Size`.

8. WHILE a page request is in flight, THE Owners_List SHALL disable the "Previous",
   "Next", and numbered page buttons to prevent duplicate requests.

9. IF the API returns an error during a page navigation request, THEN THE Owners_List
   SHALL display a visible error banner above the table with the message
   "Failed to load owners. Please try again.", restore the previously displayed page
   contents, re-enable the pagination controls, and provide a "Retry" button that
   repeats the failed request.

---

### Requirement 4: Pagination Resets on Search

**User Story:** As a clinic user, I want the page to reset to the first page whenever I
change the search filter, so that I always see results from the beginning of the filtered set.

#### Acceptance Criteria

1. WHEN the user changes the Search_Filter value, THE Owners_List SHALL reset
   `Page_Number` to `0` before issuing the new search request.

2. WHEN the Search_Filter is cleared, THE Owners_List SHALL reset `Page_Number` to `0`
   and reload the full unfiltered owner list from page `0`.

3. WHEN a search returns zero results, THE Owners_List SHALL hide the owners table and
   the Pagination_Control, and display the message "No owners matching `<filter>`".

