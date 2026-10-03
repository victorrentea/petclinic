---
base: eb6a0d1f58053105682bba4325dcc66f808b29f5
audited-base: eb6a0d1f58053105682bba4325dcc66f808b29f5
audited-head: 5904ae081a46ac1f15c144d33846cbf6fe5635a6
implementation: 5904ae081a46ac1f15c144d33846cbf6fe5635a6
head: 5904ae081a46ac1f15c144d33846cbf6fe5635a6
reviewers: 4 read-only Sonnet subagents (correctness, security, tests, ticket-fit) + pre-push hook
harness: claude-code
session: ca22c4c3-183a-49e8-b215-28211e9e12b7
fixed-in: HEAD
anchors: review-commit
---

## Fixed

### Sort header snapped back to Name asc when the table was rebuilt
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:29-30
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:259-276
- source: correctness reviewer, ticket-fit reviewer
- severity: medium
- observation: `*ngIf` destroys the table on a no-match search; recreated with a static `matSortActive="name"`, the header
  showed Name asc while every request kept sending `city,desc`.
- fix: bind `[matSortActive]`/`[matSortDirection]` to the component's sort state; the new spec fails on the old template.

### Caller-supplied values echoed into the log on 400s
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:88-90
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerListPaging.java:43-44
- source: security reviewer
- severity: medium
- observation: the type-mismatch handler logged the raw `?page=` value and the sort message embedded the raw `sort`
  token, which the ValidationException handler logs; CRLF in either forges log lines.
- fix: log only the parameter name; the sort message no longer repeats the caller's text.

### Query-budget ordering assertion passed when no pets query existed
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListQueryBudgetTest.java:81-85
- source: tests reviewer
- severity: low
- observation: `firstIndexMatching` returns MAX_VALUE on no match, so "page before pets" held vacuously when no
  statement touched `pets`.
- fix: assert both the paged query and the pets query were found before comparing their order.

### Invalid-input test accepted any 400
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListTest.java:136-139
- source: tests reviewer
- severity: low
- observation: only the status was checked, never the documented `application/problem+json` Validation Error body.
- fix: also assert the problem+json content type and the `Validation Error` title.

### Add Owner in the error state was not pinned by any test
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:256
- source: tests reviewer
- severity: low
- observation: Add Owner moved out of the table's `*ngIf` so it shows while loading and on error, but only the success
  path asserted it.
- fix: the failure spec now asserts Add Owner is still rendered.

### Two added lines over 119 characters
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListQueryBudgetTest.java:32-33
- file: petclinic-test/src/owner-search.feature.glue.ts:111-115
- source: pre-push hook
- severity: low
- observation: `scripts/check-line-length.py` refused the push: the statement-inspector property and a Cucumber step
  signature exceeded the 119-char limit.
- fix: split the constant string and wrap the step's function onto its own line.

## Ignored

### Owner deleted between page query and graph fetch fails the list with 500
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:138
- source: correctness, security and tests reviewers
- severity: medium
- observation: the two reads are not one transaction; a concurrent delete makes the IN-fetch miss an id and the
  `IllegalStateException` becomes a 500 for the whole page.
- why: design chose surfacing over silently dropping: openspec/changes/paginate-sort-owners/design.md:44

### Error view hides the paginator, so a failed page cannot be retried
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:27
- source: correctness reviewer
- severity: low
- observation: after a failed page request the table and paginator vanish; only Find Owner, back on page 0, retries.
- why: spec asks only an explicit error: openspec/changes/paginate-sort-owners/specs/owner-list/spec.md:130

### Prefix index may be skipped under a generic prepared-statement plan
- file: petclinic-backend/src/main/resources/db/migration/V4__owner_list_indexes.sql:4
- source: correctness reviewer
- severity: low
- observation: `LIKE ? ESCAPE` with a bound value can stop using `text_pattern_ops` once Postgres switches to a
  generic plan.
- why: plan measurement deferred by design: openspec/changes/paginate-sort-owners/design.md:60

### Index tests check existence, not that queries use them
- file: petclinic-backend/src/test/java/victor/training/petclinic/repository/OwnerListIndexesMigrationTest.java:33
- source: tests reviewer
- severity: low
- observation: only `pg_indexes` text is asserted; no EXPLAIN shows the planner picking the indexes.
- why: EXPLAIN on 100k rows deferred: openspec/changes/paginate-sort-owners/tasks.md:14

### Deep page index runs a deep OFFSET plus a COUNT
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerListPaging.java:32
- source: security reviewer
- severity: low
- observation: `page=107374182&size=20` passes validation and makes the database skip ~2 billion rows per call.
- why: numbered pages chosen over keyset: openspec/changes/paginate-sort-owners/design.md:62

### Unbounded lastName length in the prefix query
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:110-111
- source: security reviewer
- severity: low
- observation: a multi-kilobyte `lastName` is accepted and used in the LIKE.
- why: unchanged from before this change; Tomcat already caps the request line.

### Component error spec feeds a plain string, not the service's error
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:249-251
- source: tests reviewer
- severity: low
- observation: the component and the real error handler are never tested together.
- why: propagation is pinned in petclinic-frontend/src/app/owners/owner.service.spec.ts:91

### HttpParams sends "+" unencoded, read back as a space
- file: petclinic-frontend/src/app/owners/owner.service.ts:28
- source: ticket-fit reviewer
- severity: info
- observation: claims a prefix like `O+Brien` reaches Spring as `O Brien`.
- why: refuted by petclinic-frontend/src/app/owners/owner.service.spec.ts:86 — `+` goes out as `%2B`, green

### Name shows "First Last" but sorts by last name
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerListPaging.java:19
- source: ticket-fit reviewer
- severity: low
- observation: the order can look unsorted because the cell starts with the first name.
- why: sort chain decided by the human: Q&A.md:30

### Comment on #25 and Bizu notification left undone
- file: openspec/changes/paginate-sort-owners/tasks.md:31
- source: ticket-fit reviewer
- severity: low
- observation: task 4.4 is unchecked, so the issue still claims stale completion and "any column".
- why: publishing to GitHub awaits the human's approval; draft is ready.

### First/last buttons and index migration were not asked for
- file: petclinic-backend/src/main/resources/db/migration/V4__owner_list_indexes.sql:4-9
- source: ticket-fit reviewer
- severity: info
- observation: claims the four-button paginator and V4 indexes exceed the ticket.
- why: both in the accepted plan: openspec/changes/paginate-sort-owners/proposal.md:69 and Q&A.md:52

## Assumptions

### A non-numeric parameter is a 400 on every endpoint, not just the list
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:85-92
- alternative: parse page/size as strings locally; `/api/owners/abc` stays a 500
- confidence: 0.65
- why: a global handler is Spring's own default and the least code, but it changes untouched endpoints'
  status for malformed path ids, which nobody asked for.

### On a failed request, rows are cleared and the table hidden
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:88-90
- alternative: keep the last good page visible beneath the error
- confidence: 0.55
- why: stale rows under an error read as current data; but losing the paginator is what the correctness
  reviewer tripped on, so this is close to a coin flip.

### Add Owner is shown in every state, including loading and error
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:64
- alternative: show it only after the first successful load, as before
- confidence: 0.8
- why: the design asks for Add Owner access across loading, empty and error layouts; the old gating looked
  accidental rather than intended.

### An empty sort= or size= falls back to the default instead of a 400
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:118-122
- alternative: reject an empty value as malformed
- confidence: 0.6
- why: Spring applies `defaultValue` to empty strings and the spec only lists omitted parameters; nothing
  pins what an empty value should do.

### Sort tokens are exact lowercase; name,ASC is rejected
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerListPaging.java:39-44
- alternative: accept the direction case-insensitively
- confidence: 0.7
- why: the spec lists four exact tokens as the whitelist; a lenient parser would widen the contract
  nobody asked to widen.

### "Unrepresentable page" means page times size overflows the offset
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerListPaging.java:32
- alternative: only reject a page number that overflows an int
- confidence: 0.8
- why: Spring Data throws a 500 when the offset exceeds an int, so that is the bound a valid request
  cannot cross; the int-parse overflow is caught separately.

### Page size documented as a 5–20 range, not an enum
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:115-118
- alternative: an enum of "5","10","20", typed as strings by springdoc
- confidence: 0.7
- why: springdoc renders allowableValues as strings on an integer, a schema lie; the exact set lives in the
  description instead.

### The service omits absent parameters; the component always sends all four
- file: petclinic-frontend/src/app/owners/owner.service.ts:27-28
- alternative: the service fills in the defaults itself
- confidence: 0.85
- why: the API owns its defaults; duplicating them in the client is a second place to drift.

### Graph fetch without SQL DISTINCT
- file: petclinic-backend/src/main/java/victor/training/petclinic/repository/OwnerRepository.java:17-25
- alternative: keep `SELECT DISTINCT` as JPQL habit
- confidence: 0.9
- why: Hibernate 6 dedupes fetch-joined roots in memory; DISTINCT only added a sort over every joined column,
  and the nested-data tests stay green without it.

### Pets cell rendered as divs, not nested table rows
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:49
- alternative: keep the invalid `<tr>` inside a `<td>`
- confidence: 0.85
- why: a `<tr>` in a `<td>` is invalid HTML the browser re-parents; no test or e2e selector depended on it.

### User manual text updated, screenshot left stale
- file: user-manual/manual.md:48-50
- alternative: regenerate the screenshots by crawling the running UI
- confidence: 0.6
- why: a crawl is a separate, slow job (`regen-user-manual`); the text is what a reader acts on, but the
  picture now contradicts it.
