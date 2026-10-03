---
base: eb6a0d1f58053105682bba4325dcc66f808b29f5
audited-base: eb6a0d1f58053105682bba4325dcc66f808b29f5
audited-head: 4405c85388bb015c4a17793f0d19c163b464b2b5
implementation: 4405c85388bb015c4a17793f0d19c163b464b2b5
head: 4405c85388bb015c4a17793f0d19c163b464b2b5
reviewers: 4 read-only Plan subagents on Sonnet (correctness, security, tests, ticket-fit) + CI/SonarCloud
harness: claude-code
session: 13acbd66-def8-408d-be02-ce18a318f509
fixed-in: HEAD
anchors: review-commit
---

## Fixed

### Rejected query values echoed into the 400 body and the WARN log
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:90
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerPageRequest.java:44
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListTest.java:163
- source: correctness + security reviewers
- severity: medium
- observation: `?page=<CRLF…>` or a huge `sort` value was copied verbatim into `ProblemDetail.detail` and logged unneutralised, enabling log forging and reflecting attacker text.
- fix: name the parameter and the allowed values, never the rejected value; a test checks the body.

### Page-offset overflow boundary only tested at far extremes
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListTest.java:172
- source: tests reviewer
- severity: low
- observation: only `page=2147483647` and `page=1000000` were probed; turning `>` into `>=` or dropping the `long` cast would stay green.
- fix: assert the last page whose offset fits an int is 200 and the next one is 400.

### A failed page hid the grid, so the user could not retry in place
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:27
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:245
- source: ticket-fit reviewer
- severity: low
- observation: on an error the table, sort headers and paginator vanished; the only way back was a new search, which loses the page.
- fix: keep table and paginator under the error banner; the paginator re-requests a page.

### Unpaged `findByLastNameStartingWith` overload left in the repository
- file: petclinic-backend/src/main/java/victor/training/petclinic/repository/OwnerRepository.java:15
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerCreateTest.java:104
- source: ticket-fit reviewer
- severity: low
- observation: only a test still used the `List` overload; it invites a future caller to load every owner again.
- fix: delete it; the test asks for a one-row page.

### Duplicated validation literals in the exception advice
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:38
- source: CI (SonarCloud java:S1192)
- severity: info
- observation: the new type-mismatch handler made "Validation failed: {}" and "Validation Error" appear four times each.
- fix: two constants.

### Generic length assertions and mutable injected fields in the grid
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:78
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:33
- source: CI (SonarCloud typescript:S5906, S2933)
- severity: info
- observation: `expect(x.length).toBe(n)` reports worse than `toHaveSize`; `router` and `ownerService` are never reassigned.
- fix: `toHaveSize`, and `private readonly` constructor parameters.

## Ignored

### A "+" in the last-name prefix is sent unencoded
- file: petclinic-frontend/src/app/owners/owner.service.spec.ts:93
- source: correctness reviewer
- severity: info
- observation: claims Angular's HttpParams leaves "+" raw, so Spring reads it as a space.
- why: refuted — Angular 16 encodes "+" as %2B; this test pins `%2B`.

### Owner deleted between page and graph fetch fails the whole page
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:139
- source: correctness + security + tests reviewers
- severity: low
- observation: a concurrent delete makes the graph fetch miss an id and the request answers 500 instead of the remaining owners.
- why: design chose surfacing it over silent drops: openspec/changes/paginate-sort-owners/design.md:44

### Repeated `sort=name&sort=asc` is joined and accepted
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerPageRequest.java:41
- source: correctness reviewer
- severity: low
- observation: Spring joins repeated values with a comma, so two params spell the valid token `name,asc`.
- why: means exactly name,asc; telling it apart needs raw-request parsing for nothing.

### Huge page numbers trigger a deep OFFSET scan
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerPageRequest.java:33
- source: security reviewer
- severity: low
- observation: `?size=20&page=100000000` is valid and makes Postgres skip every row; a flood adds load.
- why: accepted offset-paging risk: openspec/changes/paginate-sort-owners/design.md:95

### No test pins the V4 indexes
- file: petclinic-backend/docs/generated/DB.sql:175
- source: tests reviewer
- severity: info
- observation: a dropped index or lost `text_pattern_ops` would leave every test green.
- why: refuted — DbSchemaExtractorTest regenerates DB.sql; CI drift check fails on a changed index.

### Latency-proxy test assertions compiled but never run
- file: petclinic-backend/src/test/java/victor/training/petclinic/perf/OwnerSearchThroughLatencyProxyTest.java:57
- source: tests reviewer
- severity: low
- observation: the new `content`/`totalElements` assertions were never executed against the proxy.
- why: deferred for budget by the plan: openspec/changes/paginate-sort-owners/tasks.md:15

### Ordering assertions depend on seed contents and collation
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListTest.java:89
- source: tests reviewer
- severity: low
- observation: the ten hard-coded seed names and the 26+7 total assume today's seed and a collation.
- why: seed ids/rows are a documented test contract; first ten are ASCII, collation-neutral.

### OwnerTest.getAll lost its George Franklin assertion
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerTest.java:130
- source: tests reviewer
- severity: info
- observation: it now checks only size 10 and the total, so wrong rows would pass there.
- why: OwnerListTest:89 pins the exact first page; the filter test still finds the fixture.

### Vanished-owner 500 path has no test
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:139
- source: tests reviewer
- severity: low
- observation: nothing exercises the IllegalStateException branch.
- why: needs a delete between two queries of one request; a mock-only test proves little.

### Task 4.4 not done: #25 not commented, Bizu not notified
- file: openspec/changes/paginate-sort-owners/tasks.md:31
- source: ticket-fit reviewer
- severity: medium
- observation: the issue still claims the work was done earlier and lacks the breaking-change and Name/City-only notes.
- why: posting on GitHub awaits the human's approval; Bizu's handle is unknown.

### Type-mismatch handler changes errors on every REST endpoint
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:87
- source: ticket-fit reviewer
- severity: low
- observation: `/api/owners/abc` and any other bad-typed param now answer 400 instead of the generic 500.
- why: a malformed client value is a 400 everywhere; scoping it to one endpoint adds code.

### `size` documented without an enum of 5/10/20
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:112
- source: ticket-fit reviewer
- severity: low
- observation: `sort` lists its allowed values in OpenAPI, `size` only in its description, so generated types accept any int.
- why: springdoc emits integer allowableValues as strings; Spectral then fails the build with an error.

## Assumptions

### An OFFSET overflowing an int counts as an unrepresentable page: 400
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerPageRequest.java:33
- alternative: answer 200 with an empty page for any int page past the end
- confidence: 0.6
- why: the spec says unrepresentable pages are 400 and past-the-end pages are 200 — it never says where one ends. Hibernate fails on an offset over Integer.MAX_VALUE, so that is where I drew it; a human could equally read "unrepresentable" as "not an int".

### Sort tokens are strictly lowercase: `name,ASC` is a 400
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerPageRequest.java:22-24
- alternative: accept any case, as Spring's Direction.fromString does
- confidence: 0.7
- why: the spec lists exactly four accepted values and rejects everything else. Lenient case would be friendlier and nobody asked for strictness, which keeps this below 0.8.

### An empty `sort=` / `size=` / `page=` means "omitted", not malformed
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:121-124
- alternative: reject an empty value with 400
- confidence: 0.65
- why: Spring's defaultValue applies to empty strings and the old `lastName=` already worked that way. The spec only defines omitted parameters, so empty is my call.

### The service sends only the parameters it is given; the grid always sends all four
- file: petclinic-frontend/src/app/owners/owner.service.ts:26
- alternative: the service fills in defaults itself
- confidence: 0.8
- why: the defaults live on the server, so a bare `getOwners()` matches a bare GET. The grid sends its full state anyway, so the server defaults never decide what the screen shows.

### Add Owner is always shown, not only after the first load
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:64
- alternative: keep it gated on the first successful load, as before
- confidence: 0.75
- why: the spec wants Add Owner available across loading, empty and error. The old gate hid it on a failed load, so keeping it would contradict that.

### A non-empty total with an empty page shows an empty table plus paginator
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:58
- alternative: jump back to the last valid page automatically
- confidence: 0.7
- why: the spec only forbids claiming "no matches" and asks that navigation back stay available. An automatic jump would send a second request nobody triggered.

### V4 copied byte-for-byte from `origin/db27oct`, so the index name differs from the design
- file: petclinic-backend/src/main/resources/db/migration/V4__owner_list_indexes.sql:1
- alternative: my own V4 with comments and the name `owners_last_name_pattern_idx`
- confidence: 0.5
- why: a database that ran db27oct would otherwise fail Flyway checksum validation on boot. Whether db27oct was ever deployed is unknown to me, and this checkout's dev DB holds a third V4 that matches neither.

### Malformed typed params get a 400 on every REST endpoint
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:89
- alternative: validate `page`/`size` as strings inside the owner list only
- confidence: 0.65
- why: the global advice already owns REST error mapping per the style rules, and 400 is right for any bad client value. It does change the error code of `/api/owners/abc` from 500 to 400, which the spec calls an unchanged contract.

### Material's default "Items per page" label, not the sketch's "Rows per page"
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:58
- alternative: a MatPaginatorIntl provider relabelling it "Rows per page"
- confidence: 0.6
- why: the proposal calls its sketch illustrative, not final, so I avoided a custom provider. A product owner may still want the sketch's wording.

### End-to-end traversal checks the UI against the API's own order
- file: petclinic-test/src/owner-search.feature.glue.ts:111
- alternative: hard-code the seeded order of all 26 owners in the feature
- confidence: 0.7
- why: other specs leave owners behind in a shared DB, so a fixed list would break on reruns. The backend tests are the independent oracle for the order itself; the e2e test proves the UI pages through it without gaps.
