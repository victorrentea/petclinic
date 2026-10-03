---
base: 953025046dffc353a4e99d094c9dbe786bdb4e8f
audited-base: 953025046dffc353a4e99d094c9dbe786bdb4e8f
audited-head: d86823865a3c7931f020d9d866ca7541b89cd969
implementation: d86823865a3c7931f020d9d866ca7541b89cd969
head: d86823865a3c7931f020d9d866ca7541b89cd969
reviewers: 4 read-only subagents (correctness, security, tests, ticket-fit; sonnet) + CI/SonarCloud
harness: claude-code
session: 33e81a92-5167-4f48-a157-691425b82012
fixed-in: HEAD
anchors: review-commit
---

## Fixed

### A failed page load left paginator and sort describing an unloaded page
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:117-119
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:106
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:261-275
- source: correctness, tests and ticket-fit reviewers
- severity: medium
- observation: `fail()` cleared the rows but kept the new pageIndex/sort and the old total, so after a failed Next the paginator read "11 – 20 of 26" over an empty table.
- fix: remember the state of the last loaded page and restore it on failure, keeping its rows.

### Type-mismatch 400 echoed raw caller input into the log and body
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:89-90
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListTest.java:135-138
- source: security and correctness reviewers
- severity: low
- observation: `?page=<CRLF or huge string>` was written verbatim by `log.warn` and reflected into ProblemDetail.detail, allowing forged log lines and log flooding.
- fix: name only the parameter, never the rejected value.

### Invalid-parameter tests asserted only the HTTP status
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListTest.java:130
- source: tests reviewer
- severity: low
- observation: any 400, whatever its body, satisfied the test, so a regression in the ProblemDetail shape would pass unnoticed.
- fix: assert the ProblemDetail title and a non-empty detail.

### release.md stated verifications without saying where they came from
- file: openspec/changes/paginate-sort-owners/release.md:23-26
- file: openspec/changes/paginate-sort-owners/release.md:36
- source: ticket-fit reviewer
- severity: low
- observation: the rollback compatibility check and the 3-SELECT budget were asserted with no test or command to back them.
- fix: name OwnerListPagingTest, and describe the one-off Flyway validation as one-off.

### Sonar: generic length assertions and mutable injected members
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:72
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:221
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:245
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:46
- source: CI (SonarCloud)
- severity: info
- observation: `expect(x.length).toBe(n)` reports badly on failure; constructor-injected services were not readonly.
- fix: `toHaveSize`, and `private readonly` on the injected services.

## Ignored

### Deep page offsets as an unauthenticated DoS through huge OFFSET scans
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerPageRequest.java:32
- source: security reviewer
- severity: info
- observation: `page=100000000&size=20` passes validation and was claimed to make Postgres walk ~2 billion index entries.
- why: OFFSET past the last row stops at table end; costs no more than the count.

### lastName has no server-side length cap
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:110
- source: security reviewer
- severity: low
- observation: the 80-character limit exists only in the frontend input; a multi-KB prefix reaches both queries.
- why: unchanged pre-existing behaviour; Tomcat already caps the request line at 8 KB.

### Task 4.4 not done: no comment on #25, Bizu not told
- file: openspec/changes/paginate-sort-owners/tasks.md:31
- source: ticket-fit reviewer
- severity: medium
- observation: the narrowed Name/City scope and the breaking envelope are never communicated on #25.
- why: publishing on GitHub waits for the human to approve the drafted comment.

### Global handler turns every controller's type-mismatch 500 into 400
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:85
- source: ticket-fit reviewer
- severity: medium
- observation: `/api/owners/abc`, `/api/pets/abc` now answer 400 instead of 500, beyond the owner list.
- why: deliberate, recorded under Assumptions; openapi.yaml already documents 400 everywhere.

### Add Owner now always rendered, outside the table
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:62
- source: ticket-fit reviewer
- severity: low
- observation: the button used to appear only after data arrived; it now shows while loading and on error.
- why: openspec/changes/paginate-sort-owners/design.md:74 requires Add Owner across loading/empty/error layouts.

### Hand-rolled query codec, getOwners/searchOwners removed
- file: petclinic-frontend/src/app/owners/owner.service.ts:13
- source: ticket-fit reviewer
- severity: low
- observation: the custom encoder and the deleted public methods widen the frontend change beyond the ticket.
- why: default codec sends '+' raw; openspec/changes/paginate-sort-owners/design.md:68 asks one query path.

### Owner deleted between page query and graph fetch makes the list 500
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:136
- source: correctness and tests reviewers
- severity: medium
- observation: a concurrent delete between the two SELECTs misses the map lookup and throws IllegalStateException; no test covers the race.
- why: openspec/changes/paginate-sort-owners/design.md:44 says surface a missing owner, never drop it.

### Latency proxy test now needs exactly 10 owners and was never run
- file: petclinic-backend/src/test/java/victor/training/petclinic/perf/OwnerSearchThroughLatencyProxyTest.java:57
- source: tests reviewer
- severity: low
- observation: `hasSize(10)` ties the load test to the default page size, and nothing executed it.
- why: 10 is the specified default; not running it is openspec/changes/paginate-sort-owners/tasks.md:15.

### Index tests check existence, not that queries use them
- file: petclinic-backend/src/test/java/victor/training/petclinic/repository/OwnerListIndexesMigrationTest.java:54
- source: tests reviewer
- severity: medium
- observation: no EXPLAIN proves the bound-parameter LIKE plus ORDER BY uses the indexes; 100k behaviour is unproven.
- why: plan and volume measurement deferred by openspec/changes/paginate-sort-owners/design.md:60.

### City-sort test orders with Java compareTo, not DB collation
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListTest.java:165
- source: tests reviewer
- severity: low
- observation: `isSortedAccordingTo(String::compareTo)` assumes Java and Postgres agree on the seeded cities.
- why: seeded cities differ in their first letters; any collation agrees. Paging test uses ASCII.

### A failed first load leaves nothing to retry
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:117
- source: correctness reviewer
- severity: info
- observation: initial GET fails, so there is an error banner, an empty table and no paginator.
- why: Find Owner resubmits the query; it is the retry.

### Sonar: duplicated literal "Validation failed: {}"
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:90
- source: CI (SonarCloud)
- severity: low
- observation: the log pattern now appears four times in the advice.
- why: three pre-existed; a constant for a log pattern reads worse.

### Sonar: prefer String#replaceAll
- file: petclinic-frontend/src/app/owners/owner.service.ts:13
- source: CI (SonarCloud)
- severity: info
- observation: `replace(/%2C/g, ',')` could be `replaceAll`.
- why: tsconfig lib is es2017; replaceAll does not typecheck.

## Assumptions

### A type mismatch on any endpoint answers 400, not 500
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:85-93
- alternative: parse page/size as strings inside listOwners only
- confidence: 0.6
- why: The catch-all advice turned Spring's natural 400 into a 500, and the contract already lists 400 for every operation. Held down because the spec says other owner contracts stay unchanged.

### Empty size=, sort=, page= fall back to the defaults
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:112-117
- alternative: reject blank values with 400
- confidence: 0.5
- why: Spring's defaultValue treats a blank value as missing, and the spec lists only explicit bad values. Nothing in the ticket or Q&A decides blanks either way.

### A page whose offset overflows an int is a 400
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerPageRequest.java:32
- alternative: accept it and answer an empty page beyond the last
- confidence: 0.75
- why: Hibernate takes an int first-result, so the offset would wrap silently. The spec's "unrepresentable page numbers" is read as covering this.

### On a failed load the last loaded page stays, with its controls
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:117-119
- alternative: clear the rows and keep the failing page's controls
- confidence: 0.6
- why: Keeps rows, paginator and sort header consistent beside the error, and clicking again retries. The spec only asks for an explicit error, not what happens to the rows.

### Every list request sends all four parameters explicitly
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:95-98
- alternative: omit parameters equal to the server defaults
- confidence: 0.85
- why: The grid's state is always complete, and an explicit URL makes traces and tests unambiguous. Defaults stay usable for other clients.

### Commas stay unescaped in query values
- file: petclinic-frontend/src/app/owners/owner.service.ts:13
- alternative: strict encodeURIComponent, sending sort=name%2Casc
- confidence: 0.8
- why: A comma is a legal sub-delimiter in a query, and keeping it keeps sort=name,asc readable in diagrams. Every other reserved character is encoded.

### The last-name prefix is submitted untrimmed
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:58
- alternative: trim whitespace before submitting the search
- confidence: 0.75
- why: The old screen sent the text as typed, and the spec says preserve filtering semantics. A trailing space now matches nothing, as before.
