---
base: f7ebe11c6a5c2d7652f6a1be2b6c75b3f2f3d9bf
audited-base: f7ebe11c6a5c2d7652f6a1be2b6c75b3f2f3d9bf
audited-head: 6305ee43b4e27cebdad0ffd75cf66b74be3bfcf9
implementation: 6305ee43b4e27cebdad0ffd75cf66b74be3bfcf9
head: 6305ee43b4e27cebdad0ffd75cf66b74be3bfcf9
reviewers: 4 parallel read-only subagents (sonnet): correctness, security, tests, ticket-fit
harness: claude-code
session: 498ee103-9160-4f7a-be05-c641ebd16920
fixed-in: HEAD
anchors: review-commit
---

## Fixed

### Sort parameter line over 119 chars blocked the push
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitRestController.java:38-39
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitRestController.java:57
- source: pre-push hook
- severity: medium
- observation: Spotless joined the `@Pattern` message onto the `sort` parameter, making a 125-char added line; the line-length gate refused the push.
- fix: the regex and the 400 hint move into `SORTS` and `SORTS_HINT` constants, with the hint shortened to fit.

### Cucumber visit-count step read only the first page of all visits
- file: petclinic-backend/src/test/java/victor/training/petclinic/functional/VisitSteps.java:57-59
- source: tests reviewer
- severity: medium
- observation: the step filtered `content` of `GET /api/visits`, which is the 10 latest visits only. A visit beyond that page counts as absent, so a "0 visits" check passes vacuously.
- fix: read the pet's own visits from `GET /api/pets/{id}` instead of a page of everyone's.

## Ignored

### Service fallback `{}` would hide errors and crash `show()`
- file: petclinic-frontend/src/app/visits/visit.service.ts:37
- source: correctness, security and ticket-fit reviewers
- severity: info
- observation: `catchError(handlerError(..., {} as VisitPage))` would emit `{}`, so `page.content.length` throws and the error banner never shows.
- why: refuted — `HttpErrorHandler.handleError` rethrows (`return throwError(message)`, error.service.ts:43); the fallback is never emitted.

### Page index has no upper bound
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitRestController.java:55
- source: security reviewer
- severity: low
- observation: `page=2000000000&size=100` makes the database run a huge OFFSET plus a count on every call.
- why: endpoint is admin-only; OFFSET past the end stops at table size. Same as owners paging.

### Owner sort by first name may not match the displayed order
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitRestController.java:73
- source: ticket-fit reviewer
- severity: info
- observation: sorting by owner orders on first name, then last name, which looks wrong if the cell shows last name first.
- why: refuted — the cell shows "First Last" (visits-page.component.html:31), the same order as the sort.

### API accepts sizes 1..100, not only 5/10/20
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitRestController.java:56
- source: ticket-fit reviewer
- severity: low
- observation: the ticket names 5, 10 and 20 rows, yet `?size=7` or `?size=100` is served. The UI quietly resets an unsupported URL size to 10.
- why: the ticket constrains the grid; the API serves other clients. Recorded under Assumptions.

### Past-the-end redirect could loop or show stale rows
- file: petclinic-frontend/src/app/visits/visits-page/visits-page.component.ts:75-77
- source: correctness reviewer
- severity: low
- observation: when the last page empties after deletes, `show()` navigates to `totalPages`. If the data shifts again it re-navigates while the old rows stay on screen.
- why: each redirect needs a fresh empty answer; it converges as soon as deletes stop.

### Text sort order depends on database collation
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitRestController.java:70-73
- source: correctness reviewer
- severity: info
- observation: mixed-case descriptions or pet names ("abc", "Zed") may sort differently on H2 and on Postgres.
- why: Postgres is the only database here (dev and tests); there is no H2 in the project.

### Pet and owner sort direction and tie-breaks not pinned
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/VisitListTest.java:150
- source: tests reviewer
- severity: low
- observation: the pet sort is tested ascending only and the owner sort descending only, so flipping direction there would stay green.
- why: one shared `direction` variable; asc and desc both pinned for description, owner tie-break pinned.

### Query-count bound of 3 is loose
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/VisitListTest.java:236
- source: tests reviewer
- severity: low
- observation: `isLessThanOrEqualTo(3)` would still pass with one extra lazy load if the count query were skipped.
- why: an N+1 regression over 20 rows needs 20+ statements; the bound catches that.

### Uppercase or malformed sort values untested
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/VisitListTest.java:218
- source: tests reviewer
- severity: info
- observation: `sort=date,ASC`, `sort=date,asc,extra` and `page=abc` are never tested, and the uppercase form is rejected.
- why: the 400 on anything off-pattern is intended and pinned by unsupportedSortKey_isRejected.

### Frontend specs stub the router, so the URL round trip is unproven
- file: petclinic-frontend/src/app/visits/visits-page/visits-page.component.spec.ts:67
- source: tests reviewer
- severity: low
- observation: `Router.navigate` is stubbed and `ActivatedRoute` faked, so a real routing bug would pass every unit test.
- why: Playwright drives the real round trip: header click and next page (visits.spec.ts:49, 61).

### Removed getAll tests thin seed-data and role coverage
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/VisitTest.java:103
- source: tests reviewer
- severity: low
- observation: no test checks that the list still returns seeded rows, or that a non-admin gets a 403.
- why: class-level `@PreAuthorize` is unchanged; Playwright compares the grid to the seeded API page.

## Assumptions

### Paging runs on the server, not in the browser
- file: petclinic-backend/src/main/java/victor/training/petclinic/repository/VisitRepository.java:20-22
- alternative: keep the bare list; page and sort client-side with MatTableDataSource
- confidence: 0.7
- why: The owners grid (#25) paged on the server, and visits grow without bound. The ticket says only "paginated", and the browser-side version needed no API break, which pulls this down.

### Default view is the 10 latest visits
- file: petclinic-frontend/src/app/visits/visits-page/visits-page.component.ts:17
- alternative: the first page in id or ascending-date order
- confidence: 0.9
- why: The grid already sorted newest first before paging, so this keeps what users saw. Ten is the middle of the three sizes the ticket names.

### API caps the page size at 100, not at the three UI sizes
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitRestController.java:56
- alternative: reject any size other than 5, 10 or 20 in the API too
- confidence: 0.65
- why: It copies the owners endpoint (MAX_PAGE_SIZE = 100), and the ticket describes the grid, not the API. A stricter reading of "5, 10, or 20" would hold the API to it too.

### Owner column sorts by first name, then last name
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitRestController.java:73
- alternative: sort by last name, as a clinic register usually does
- confidence: 0.75
- why: The cell reads "First Last", so this sort matches what is shown, and owners' Name sort does the same. A clinic looking people up by surname would want last name first.

### Ties within a sorted column fall back to latest first, then id
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitRestController.java:68
- alternative: tie-break by id only, as the owners grid does
- confidence: 0.6
- why: When one pet has several visits, showing them chronologically is the useful order, and the id still makes paging stable. Nobody asked for it, so a plain id tie-break is equally defensible.

### No index added for the date sort
- file: petclinic-backend/src/main/java/victor/training/petclinic/repository/VisitRepository.java:20
- alternative: a Flyway migration indexing visits(visit_date, id)
- confidence: 0.5
- why: The seed has 28 visits and the ticket does not mention scale. If volume grows, sorting the whole table per page will show up, so this is a coin flip on when.
