---
base: f78a360af2d7329451d88b900fe9b3619869e843
audited-base: f78a360af2d7329451d88b900fe9b3619869e843
audited-head: f242cbeec80c39c01da33a33e5a121fb975d6d41
implementation: f242cbeec80c39c01da33a33e5a121fb975d6d41
head: f242cbeec80c39c01da33a33e5a121fb975d6d41
reviewers: 4 read-only Sonnet subagents (correctness, security, ticket-fit, tests) on the RR briefs
harness: claude-code
session: e7cc9112-be45-4d7b-9c2e-741d6e6f951b
fixed-in: HEAD
anchors: review-commit
---

## Fixed

### Line over 119 chars blocked the push
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:67
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:125
- source: pre-push hook
- severity: medium
- observation: The commit-time formatter wrapped the sort parameter's inline message onto a 122-char line, and check-line-length.py refused the push.
- fix: Moved the message into a SORT_MESSAGE constant.

### Add-visit fixtures searched only the first page of owners
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/AddVisitApiTest.java:106-117
- file: petclinic-test/src/add-visit.dsl.ts:16-25
- source: correctness, ticket-fit, tests reviewers
- severity: medium
- observation: Both helpers looked for an owner with a pet among the first 10 owners only. A seed where those 10 have no pets fails the scenario, even though such owners exist on later pages.
- fix: Page through the list until an owner with a pet turns up, or the pages run out.

### A failed load dropped the user's place with no retry
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:67-69
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:24
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:244-256
- source: correctness, tests reviewers
- severity: low
- observation: After a 5xx the table and paginator disappear. The only way back was a new search, which resets to page 0. The user's page, size and sort were never re-requested.
- fix: The error banner gets a "Try again" button that re-sends the failed page's exact query.

### Query budget not pinned for default size or City sort
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListQueryBudgetTest.java:80-82
- source: tests reviewer
- severity: low
- observation: The ≤3-SELECT test ran only sizes 5 and 20, always sorted by Name, so an N+1 on the default size or the City sort would stay green.
- fix: Parameterized over size and sort: 5 name,asc / 10 city,desc / 20 name,desc.

## Ignored

### Angular HttpParams leaves '+' unencoded, so it is read as a space
- file: petclinic-frontend/src/app/owners/owner.service.spec.ts:89-93
- source: security, correctness reviewers
- severity: info
- observation: Searching "A+B" would send a literal '+', which Spring decodes as a space.
- why: Refuted: this spec asserts '+' goes out as %2B, and it passes on Angular 16.

### Owner deleted between the page and graph queries yields a 500
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:147
- source: correctness, security reviewers
- severity: low
- observation: A concurrent delete between the queries throws IllegalStateException. The 500 body echoes the owner id, and the total can disagree with the rows.
- why: openspec/changes/paginate-sort-owners/design.md:44 mandates surfacing it; cross-request snapshot is out of scope (design.md:92).

### Deep page numbers allow costly OFFSET scans
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:118
- source: security reviewer
- severity: low
- observation: page up to ~107M is accepted, and each call runs a COUNT plus a deep OFFSET.
- why: Numbered offset paging chosen (design.md:62); OWNER_ADMIN-only endpoint; load tests deferred.

### lastName has no length bound
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:116
- source: security reviewer
- severity: low
- observation: Several KB of prefix goes unchecked into the LIKE and count queries.
- why: Same as before this change; Tomcat's request-size limits cap it; bound literal, no injection.

### Issue #25 comment and Bizu notification not done
- file: openspec/changes/paginate-sort-owners/tasks.md:34
- source: ticket-fit reviewer
- severity: medium
- observation: Task 4.4 is unticked, so #25 still carries the stale "implemented" claim and nobody was told about the breaking rollout.
- why: The human forbade posting anything on GitHub in this run; left open in tasks.md.

### Name sorts by last name although the cell shows "First Last"
- file: Q&A.md:30
- source: ticket-fit reviewer
- severity: info
- observation: "Zed Adams" sorts before "Alice Baker" even though the cell starts with the first name.
- why: The human decided this in Q&A.md:30 (Q3).

### Performance at 100k owners unverified
- file: openspec/changes/paginate-sort-owners/proposal.md:89
- source: ticket-fit reviewer
- severity: info
- observation: The latency test was only compiled; the indexes and the 3-SELECT bound were checked only on small fixtures.
- why: Deferred for budget by the proposal (proposal.md:89, design.md:60).

### First/last paginator buttons and a global validation handler were not asked for
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:79
- source: ticket-fit reviewer
- severity: info
- observation: The global HandlerMethodValidationException handler changes 400 bodies for other endpoints, and the first/last buttons were not requested.
- why: Buttons are in proposal.md:69; no other endpoint has parameter constraints, these were 500s before.

### Expected order computed by Java comparators, not DB collation
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListTest.java:49
- source: tests reviewer
- severity: low
- observation: Mixed-case or accented names would sort differently under en_US collation, and the ASCII-only fixtures cannot reveal that.
- why: The fixtures are same-case ASCII on purpose, so both orders agree; collation is not under test.

### Migration test checks index definitions, not query plans
- file: petclinic-backend/src/test/java/victor/training/petclinic/repository/OwnerListIndexesMigrationTest.java:55
- source: tests reviewer
- severity: low
- observation: The planner may not use the indexes for the LIKE or ORDER BY, and the test would still pass.
- why: The planner ignores indexes on tiny tables; EXPLAIN on 100k rows is deferred (design.md:60).

## Assumptions

### "Unrepresentable" page means its offset overflows Hibernate's int
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:65
- alternative: Accept any int page and let a huge offset fail at query time
- confidence: 0.7
- why: The spec (specs/owner-list/spec.md:23) demands a 400 for unrepresentable pages without defining the term. Capping at MAX_INT/20 is the tightest bound that holds at every allowed size, but a lower business cap would be equally defensible.

### Invalid parameters rejected by bean validation plus a @OneOf constraint
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:120
- alternative: A custom exception that rest throws and rest.error maps
- confidence: 0.75
- why: packages.puml forbids rest → rest.error, so a custom exception would need an architecture change. Spring's own HandlerMethodValidationException keeps both packages independent; the cost is one small constraint annotation.

### Type-mismatch 400 applies to every REST endpoint, not only the list
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:92-96
- alternative: Scope the 400 to listOwners and keep 500 elsewhere
- confidence: 0.6
- why: The spec needs page=abc to return 400, and a 500 for malformed input is wrong everywhere. Still, /api/owners/abc changing from 500 to 400 is a contract change nobody asked for.

### Allowed sizes and the sort default stated in OpenAPI descriptions
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:119-122
- alternative: A custom OpenAPI customizer emitting an integer enum and default
- confidence: 0.6
- why: springdoc renders allowableValues as strings, which Spectral rejects, and drops a default that contains a comma. Prose keeps the lint green, but machines cannot read the 5/10/20 rule from the schema.

### A failure hides the grid instead of keeping stale rows
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:96-97
- alternative: Keep the last rows visible under the error banner
- confidence: 0.55
- why: The spec says a failure must not look like a result, and stale rows under a new query would. Showing the previous rows greyed out is a reasonable UX that the spec does not exclude.

### An empty page within a non-empty result shows a "go back" row
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:48
- alternative: Jump to the last valid page automatically
- confidence: 0.65
- why: The spec only forbids claiming "no matches" and requires navigation to stay available. Auto-jumping would send an extra request nobody triggered.
