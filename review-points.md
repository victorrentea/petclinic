---
base: 98cb82a7249fe9341595b3a5beb4b7a71a7f22ec
audited-base: 98cb82a7249fe9341595b3a5beb4b7a71a7f22ec
audited-head: 91905dff4690930507b443b5655573f6802ef608
implementation: 91905dff4690930507b443b5655573f6802ef608
head: 91905dff4690930507b443b5655573f6802ef608
reviewers: 4 read-only reviewer subagents (correctness, security, tests, ticket-fit) on Sonnet + SonarCloud via CI
harness: claude-code
session: 3c9a707b-94ad-4b3f-8775-28518fc03842
fixed-in: HEAD
anchors: review-commit
---

## Fixed

### A failed page hid the paginator, so only a new search could retry
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:38
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:94-97
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:289-312
- source: correctness, tests and ticket-fit reviewers
- severity: low
- observation: on error the component set loaded=false, which hid the paginator with the table. A transient 500 on page 3 could be retried only through Find Owner, which restarts from page 0.
- fix: keep the last good total on failure so the paginator stays; noMatches now also requires no error.

### Paging step waited for rows to change, which a page may not do
- file: petclinic-test/src/owner-search.feature.glue.ts:69-79
- file: petclinic-test/src/owner-search.feature.glue.ts:117
- source: correctness and ticket-fit reviewers
- severity: low
- observation: the step polled until the listed ids differed. A sort or size change that leaves the first page's ids unchanged would time out after 10 s.
- fix: wait for the /api/owners response, then for the table's aria-busy to turn false.

### Rejected request values echoed into the log and the 400 body
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:86-96
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerSort.java:33
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerSort.java:42-44
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListTest.java:118-126
- source: security reviewer
- severity: low
- observation: `?page=x%0d%0a…` and `?sort=…` were copied into log.warn and the ProblemDetail. A caller could forge log lines and have arbitrary text reflected back.
- fix: name the parameter and the expected type or values, never the raw value.

### Validation literals duplicated four times in the advice
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:38-39
- source: CI (SonarCloud java:S1192)
- severity: info
- observation: the new type-mismatch handler made "Validation failed: {}" and "Validation Error" the fourth copy of each.
- fix: two constants.

### Size assertions on .length instead of toHaveSize
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:90
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:97
- source: CI (SonarCloud typescript:S5906)
- severity: info
- observation: eleven `expect(x.length).toBe(n)` report a bare number on failure, not the collection.
- fix: toHaveSize throughout the spec.

### Injected services not readonly
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:34
- source: CI (SonarCloud typescript:S2933)
- severity: info
- observation: the router and the owner service are never reassigned.

## Ignored

### Owner deleted between page query and graph fetch answers 500
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:145
- source: correctness reviewer
- severity: medium
- observation: a concurrent delete after the page SELECT leaves an id the graph fetch cannot find, and the request fails.
- why: design.md decided to surface it, never silently drop a selected owner.

### Page, count and graph fetch share no snapshot
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:106
- source: correctness reviewer
- severity: low
- observation: a write between the count and the page query can make totalElements disagree with content.
- why: design.md Risks accepts offset drift under concurrent writes; snapshots are out of scope.

### Empty table chrome shows before the first page arrives
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:27
- source: correctness reviewer
- severity: low
- observation: headers render with no rows while the first request is in flight.
- why: marked aria-busy and claims nothing; no false "no owners" message.

### HttpParams sends "+" raw, read as a space
- file: petclinic-frontend/src/app/owners/owner.service.ts:28
- source: correctness reviewer
- severity: info
- observation: a prefix like O+Brien would be decoded by the server as "O Brien".
- why: refuted — Angular 16 encodes '+'; owner.service.spec.ts:80 decodes it back verbatim.

### lastName has no length cap
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:109
- source: security reviewer
- severity: low
- observation: a multi-KB prefix goes into the LIKE parameter unbounded.
- why: pre-existing filter, bound as a parameter; Tomcat caps the request line.

### Name column shows "First Last" but sorts by last name
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerSort.java:12
- source: tests reviewer
- severity: low
- observation: rows read as unsorted to a user scanning first names; tests only mirror the SQL order.
- why: Q3 decided by the human: Name sorts by last name, first name, id.

### Index test never checks the planner uses the indexes
- file: petclinic-backend/src/test/java/victor/training/petclinic/repository/OwnerListIndexesMigrationTest.java:41
- source: tests reviewer
- severity: medium
- observation: only the DDL is asserted; a seq scan would leave every test green.
- why: plans need 100k rows; that measurement is deferred by the spec.

### Query-budget test is @Transactional, may mask lazy loads
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListQueryBudgetTest.java:51
- source: tests reviewer
- severity: info
- observation: one session spans the request, unlike production, so a missed association might go unnoticed.
- why: refuted — statistics count every prepared statement, lazy loads included; a miss exceeds 3.

### OwnerTest.getAll narrowed to lastName=Franklin
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerTest.java:131
- source: tests reviewer
- severity: info
- observation: the unfiltered default page is no longer requested there.
- why: refuted — OwnerListTest.java:47 pins the unfiltered default page against SQL.

### No recovery when the current page falls past the last
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:57
- source: tests reviewer
- severity: info
- observation: owners deleted elsewhere leave an empty page with a nonzero total.
- why: the spec asks only that navigation stays; its component test covers it.

### `sort.direction || 'asc'` hides a cleared sort
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:64
- source: ticket-fit reviewer
- severity: info
- observation: if clearing ever fired, the grid would load ascending while the header shows no arrow.
- why: matSortDisableClear prevents it; the bound matSortDirection redraws the arrow anyway.

### V4 indexes nobody asked for
- file: petclinic-backend/src/main/resources/db/migration/V4__owner_list_indexes.sql:3
- source: ticket-fit reviewer
- severity: info
- observation: three indexes add write overhead on owners, unmeasured.
- why: design.md Decision 3 and task 2.1 specify them.

### Add Owner shown during load and after errors
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:62
- source: ticket-fit reviewer
- severity: info
- observation: the old isOwnersDataReceived gate is gone.
- why: the spec requires Add Owner across loading, empty and error layouts.

## Assumptions

### An empty ?size=, ?page= or ?sort= means omitted, not malformed
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:115
- alternative: answer 400 for an empty value
- confidence: 0.6
- why: Spring's defaultValue also covers an empty string, and the spec defines only the omitted case. Pulling it down: the spec says malformed input is a 400, and `size=` could be read as malformed.

### A type mismatch is a 400 on every endpoint, not only the list
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:85
- alternative: scope the 400 to listOwners, leave /api/owners/abc a 500
- confidence: 0.7
- why: a 500 for bad client input is wrong everywhere, and the advice is global by design. Pulling it down: the spec promises the detail and CRUD contracts unchanged, and /api/owners/abc moved from 500 to 400.

### A page whose offset overflows an int is a 400
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:128
- alternative: clamp it and answer an empty page
- confidence: 0.8
- why: the spec names "unrepresentable" page numbers as a 400, and Hibernate's offset is an int. Only how far "unrepresentable" reaches was mine to choose.

### Sort keys and directions are case-sensitive
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerSort.java:31
- alternative: accept Name,ASC and similar
- confidence: 0.75
- why: the spec lists exactly four lowercase tokens and rejects everything else. A lenient parser would be friendlier to hand-written URLs, but nothing in-repo writes them.

### The error view shows the server's message verbatim
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:24
- alternative: a generic "could not load owners", details only in the console
- confidence: 0.55
- why: the spec asks only for an explicit error. The handler's text ("server returned code 500…") helps whoever reports it, but it is technical wording on a clinic screen.

### No-match message keeps the old "LastName" wording
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:26
- alternative: reword it to "last name"
- confidence: 0.85
- why: the spec only adds the submitted prefix, and e2e text matches may rely on the old wording.
