---
ticket: victorrentea/petclinic#52
base: b62a1447dd3f9455b9b5e5264a215aaef66dc889
audited-base: b62a1447dd3f9455b9b5e5264a215aaef66dc889
audited-head: 2077cc41fd02d74c01b53809fdf5a268ba0f4da9
implementation: 2077cc41fd02d74c01b53809fdf5a268ba0f4da9
head: 2077cc41fd02d74c01b53809fdf5a268ba0f4da9
reviewers: 4 read-only Sonnet subagents (correctness, security, ticket-fit, tests) + SonarCloud
harness: claude-code
session: 7969568c-206d-4180-a51c-6efb84658cd8
fixed-in: HEAD
anchors: review-commit
---

## Fixed

### A failed page load ended the grid's reload stream for good
- file: petclinic-frontend/src/app/visits/visits-page/visits-page.component.ts:34
- file: petclinic-frontend/src/app/visits/visit.service.ts:28
- file: petclinic-frontend/src/app/visits/visits-page/visits-page.component.spec.ts:88-99
- source: correctness reviewer, ticket-fit reviewer
- severity: medium
- observation: Reviewers read the `noRows` fallback as "a server error shows No visits found". Worse: `handlerError` rethrows, so the error reached `switchMap` and completed the stream; every later sort or page click did nothing.
- fix: catch inside the `switchMap` and keep the shown page; drop the dead fallback.

### Non-numeric page or size answered 500
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:84-91
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/VisitGridTest.java:157-158
- source: correctness reviewer, security reviewer
- severity: medium
- observation: `GET /api/visits?page=abc` throws `MethodArgumentTypeMismatchException`, which only the catch-all handler caught, as a 500.
- fix: map it to a 400 ProblemDetail naming the parameter, not echoing its value.

### ResponseStatusException handler crashed on a non-standard status code
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:79-81
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:40
- source: correctness reviewer
- severity: low
- observation: `HttpStatus.valueOf` throws for a code outside the enum, turning the intended status into a 500.
- fix: carry `HttpStatusCode` through `buildProblemDetail` instead of resolving the enum.

### No test pages across a tie, so dropping the id tiebreaker stays green
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/VisitGridTest.java:103-113
- source: tests reviewer
- severity: medium
- observation: `secondPageOfTwo` reads one page only; nothing compares page 0 with page 1, so duplicated or skipped rows across pages pass.
- fix: seven visits on one date, pages 0 and 1 together must hold 10 distinct ids.

### Page size 20 never requested in a test
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/VisitGridTest.java:115-119
- source: tests reviewer
- severity: low
- observation: Removing 20 from the allowed sizes would leave every test green.
- fix: a parameterized test serves 5, 10 and 20.

### Sonar: sortOf cognitive complexity 20, over the 15 allowed
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitRestController.java:71-74
- source: CI (SonarCloud java:S3776)
- severity: low
- observation: Each column's two nested direction checks pushed the method over the threshold.
- fix: reject a bad direction once up front; each column keeps one `if` building its `Sort`, as Q&A.md:12 asks.

### Sonar: visitService constructor property should be readonly
- file: petclinic-frontend/src/app/visits/visits-page/visits-page.component.ts:26
- source: CI (SonarCloud typescript:S2933)
- severity: low
- observation: The injected service is never reassigned but was not marked `readonly`.
- fix: `private readonly visitService`.

## Ignored

### Owner full names written to the INFO log on every page served
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitRestController.java:66
- source: security reviewer, ticket-fit reviewer, correctness reviewer
- severity: low
- observation: Up to 20 owners' names (personal data) logged per request; a newline in a name could forge a log line.
- why: the human asked for exactly this log line, Q&A.md:15.

### Breaking contract: GET /api/visits no longer returns a VisitDto array with petId
- file: petclinic-backend/src/main/java/victor/training/petclinic/repository/VisitRepository.java:22-26
- source: ticket-fit reviewer
- severity: info
- observation: Clients expecting a JSON array of VisitDto now get a paged object of rows without `petId`.
- why: return the row, Q&A.md:9; every in-repo consumer was updated in this change.

### App-wide ResponseStatusException handler nobody asked for, echoing its reason
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:76
- source: ticket-fit reviewer, security reviewer
- severity: info
- observation: Every ResponseStatusException now gets this ProblemDetail, its reason sent to the client and logged at WARN.
- why: Q&A.md:12 demands a 400; the catch-all made it 500. Reasons are constant strings.

### Sonar: literal "description" repeated three times in sortOf
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitRestController.java:79-82
- source: CI (SonarCloud java:S1192)
- severity: low
- observation: The column name and the sort property repeat the same literal.
- why: plain ifs showing every allowed sort at a glance, Q&A.md:12; constants would hide it.

### Third header click clears the sort and silently returns to date-desc
- file: petclinic-frontend/src/app/visits/visits-page/visits-page.component.ts:21-22
- source: ticket-fit reviewer
- severity: low
- observation: After the third click no column shows a sort arrow and the grid goes back to newest first.
- why: matSort's own cycle; the default view is newest first, Q&A.md:6.

### Old getAll tests disabled, leaving no coverage of the list JSON
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/VisitTest.java:107
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/VisitGridTest.java:78
- source: tests reviewer
- severity: info
- observation: `getAll` and `getAll_returnsEnrichedFields` are skipped, so renamed or dropped fields of the paged response would stay green.
- why: disabling them is Q&A.md:18; `rowCarriesPetAndOwner` pins every row field.

### E2E demands exactly 10 rows and never exercises sizes 5 or 20
- file: petclinic-test/src/visits-sort.feature.glue.ts:50
- source: ticket-fit reviewer
- severity: info
- observation: The step fails on a dataset under 10 visits and covers no other page size or paging.
- why: "keep it that simple", Q&A.md:21; @fixture:default holds 28 visits.

### E2E sort check passes for a client-side sort of a wrong page
- file: petclinic-test/src/visits-sort.feature.glue.ts:35
- source: tests reviewer
- severity: info
- observation: It checks only that the first page is ordered, which a client-side sort would also satisfy.
- why: each click awaits a request carrying `sort=`; VisitGridTest pins the server's order.

### Unit spec calls onSort/onPage directly; template bindings untested
- file: petclinic-frontend/src/app/visits/visits-page/visits-page.component.html:10
- source: tests reviewer
- severity: low
- observation: A broken `(matSortChange)` or `(page)` binding, or a missing module, passes the component spec.
- why: visits-sort.feature clicks the real headers in a browser; it fails on that.

### Page past the end after visits are deleted shows an empty grid
- file: petclinic-frontend/src/app/visits/visits-page/visits-page.component.ts:55-58
- source: correctness reviewer
- severity: low
- observation: When rows vanish elsewhere, the current page index can exceed the last page and the server returns no content.
- why: rare; the paginator still shows the total, and first/previous recover it.

## Assumptions

### Default view: newest first, 10 a page
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitRestController.java:57
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitRestController.java:60
- source: human
- why: Q&A.md:6 decides it.
- confidence: 1.0

### Owner sorts as displayed: first name, then last name
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitRestController.java:87-90
- alternative: last name first, the usual clinic-desk order
- why: The cell reads "Alice Young", so first-name order is what the user sees sorted. Nobody specified; a front desk might expect surname order, which pulls it down.
- confidence: 0.55

### A page size outside 5/10/20, or a negative page, is a 400
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitRestController.java:61-62
- alternative: clamp to the nearest allowed size
- why: Same whitelist stance as the sort in Q&A.md:12, and it bounds the query size. Only the sort's 400 was decided by the human.
- confidence: 0.8

### Every sort ends on visit id
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitRestController.java:64
- alternative: the column alone, letting Postgres break ties
- why: Without a total order, rows with equal values can repeat or vanish between pages. No reading of the ticket wants that.
- confidence: 0.95

### Sort column and direction as two query parameters
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitRestController.java:58-60
- alternative: Spring's single `sort=date,desc`
- why: Two params need no parsing and map one-to-one onto the column and direction ifs. Q&A.md:12 names the `sort` param but not its format.
- confidence: 0.7

### A named VisitPageDto subclass of PagedModel, only for the contract
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/dto/VisitPageDto.java:9
- alternative: return `PagedModel<VisitRowDto>` and drop the response example
- why: springdoc gave no schema for the generic type with a hand-written example; every list endpoint here keeps one.
- confidence: 0.7
