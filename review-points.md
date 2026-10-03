---
base: eb6a0d1f58053105682bba4325dcc66f808b29f5
audited-base: eb6a0d1f58053105682bba4325dcc66f808b29f5
audited-head: e270e495b92c6dfe81250fa8f2e5db7d9c596102
implementation: e270e495b92c6dfe81250fa8f2e5db7d9c596102
head: e270e495b92c6dfe81250fa8f2e5db7d9c596102
reviewers: 4 read-only Sonnet reviewer subagents (correctness, security, ticket-fit, tests)
harness: claude-code
session: 9d1c9978-8d4a-40ae-be07-2743af9c0afa
fixed-in: HEAD
anchors: review-commit
---

## Fixed

### Overlong lines refused by the push gate
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListQueryTest.java:79-80
- file: petclinic-test/src/owner-search.feature.glue.ts:129-132
- source: pre-push hook
- severity: low
- observation: the fixture cleanup SQL (144 chars) and one step definition (121 chars) broke the 119-char rule, so the push was refused.
- fix: wrapped both.

### A failed page leaves no way to retry it
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:24
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:72-74
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:252-267
- source: correctness, ticket-fit and tests reviewers
- severity: medium
- observation: a failure hides the table and paginator; the only way back was a new search, which resets to page 0 and loses the page, size and sort.
- fix: a Retry button in the error banner reloads the same page, filter, size and sort.

### Type-mismatch handler logs and echoes the raw client value
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:88-89
- source: security reviewer
- severity: medium
- observation: `?page=x%0A…` was written verbatim to the log (log forging) and reflected unbounded in the 400 `detail`.
- fix: name only the parameter, never its value.

### 400 tests did not prove which handler answered
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListTest.java:103
- source: tests reviewer
- severity: low
- observation: the invalid-input cases asserted only the status, so any 400 from anywhere passed, including one without the project's ProblemDetail.
- fix: also assert the `Validation Error` title the advice writes.

## Ignored

### Owner deleted between page and graph query answers 500
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:140
- source: correctness, security and tests reviewers
- severity: low
- observation: a concurrent delete between the two queries throws IllegalStateException, so the list request fails instead of returning a short page.
- why: the design forbids silently dropping a selected owner: openspec/changes/paginate-sort-owners/design.md:44

### Page, count and graph fetch are not one snapshot
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:122-123
- source: correctness reviewer
- severity: low
- observation: writes between the statements can make rows, total and fetched graph disagree, or repeat/skip owners across pages.
- why: accepted risk, snapshot/keyset out of scope: openspec/changes/paginate-sort-owners/design.md:92

### "+" in the prefix is sent unencoded and read as a space
- file: petclinic-frontend/src/app/owners/owner.service.ts:28
- source: correctness and ticket-fit reviewers
- severity: info
- observation: claimed HttpParams leaves `+` literal, so Spring would decode `A+B` as `A B`.
- why: refuted — the test asserts `%2B` on the wire: petclinic-frontend/src/app/owners/owner.service.spec.ts:86

### Paging uses the submitted prefix, not the typed one
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:60
- source: correctness reviewer
- severity: info
- observation: after typing without pressing Find, page navigation shows rows that do not match the visible input.
- why: required behaviour: openspec/changes/paginate-sort-owners/specs/owner-list/spec.md:107

### Uncapped prefix and a COUNT per request invite DB load
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:122
- source: security reviewer
- severity: low
- observation: every request runs a count plus an ordered query, with no length cap or rate limit.
- why: endpoint is OWNER_ADMIN-only; scale testing deferred: openspec/changes/paginate-sort-owners/proposal.md:89

### 500 body echoes the vanished owner's id
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:99
- source: security reviewer
- severity: low
- observation: the catch-all handler puts the exception message, here an owner id, in the 500 response.
- why: pre-existing catch-all behaviour for every endpoint; an id is not sensitive.

### Issue #25 not yet commented, Bizu not notified
- file: openspec/changes/paginate-sort-owners/tasks.md:31
- source: ticket-fit reviewer
- severity: low
- observation: task 4.4 is still open, so the issue still carries the earlier false "implemented" claim.
- why: public post awaiting the human's go-ahead and Bizu's GitHub handle.

### release.md and the 400 handler exceed the ticket
- file: openspec/changes/paginate-sort-owners/release.md:21
- source: ticket-fit reviewer
- severity: info
- observation: neither a release document nor a type-mismatch handler was asked for; the rollback claim has no shipped test.
- why: release.md is task 5.3 (tasks.md:37); `page=abc` → 400 is specified (spec.md:31).

### Paging and query budget unproven at 100k owners
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:135
- source: ticket-fit reviewer
- severity: low
- observation: the graph fetch joins pets and visits, so large pages can return many rows; the indexes are unproven at scale.
- why: explicitly deferred: openspec/changes/paginate-sort-owners/design.md:60

### E2E sort order compared against the API under test
- file: petclinic-test/src/owner-search.feature.glue.ts:125
- source: tests reviewer
- severity: low
- observation: expected orders other than name ascending come from the same endpoint, so a wrong backend order would pass.
- why: backend order is proven independently in OwnerListQueryTest.java:93; E2E checks the grid shows it.

### Owner list test narrowed to lastName=Franklin
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerTest.java:131
- source: tests reviewer
- severity: info
- observation: the unfiltered list is no longer asserted through OwnerTest.
- why: refuted — the default unfiltered page is asserted in OwnerListTest.java:48.

### Migration test checks index names, not that plans use them
- file: petclinic-backend/src/test/java/victor/training/petclinic/repository/OwnerListIndexesMigrationTest.java:41
- source: tests reviewer
- severity: low
- observation: a wrong column order or opclass in V4 would still pass; there is no EXPLAIN check.
- why: on 26-row tables the planner seq-scans anyway; plan checks belong with the deferred 100k run.

## Assumptions

### Type-mismatch 400 handler is global, not owner-only
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:84-92
- alternative: bind page/size as strings and parse them in OwnerPageRequest
- confidence: 0.7
- why: `page=abc` must answer 400 and the catch-all made it 500. The handler fixes it at the root, but it also turns malformed ids on other endpoints from 500 into 400, a behaviour change nobody asked for.

### "Unrepresentable page" means an offset past Integer.MAX_VALUE
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerPageRequest.java:32-33
- alternative: accept any int page, answering an empty 200 beyond the last
- confidence: 0.6
- why: Spring Data throws on an int-overflowing offset, so a page that parses as an int can still be unservable. The spec's "unrepresentable" might only have meant non-int input.

### On failure the grid empties instead of keeping stale rows
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:104
- alternative: keep the previous rows visible under the error banner
- confidence: 0.6
- why: stale rows under a new page number would be shown as if they were the answer, which is what the spec forbids for failures. The Retry button makes the cost of clearing small, but a UX call either way.

### `size` enum documented in prose, not as an OpenAPI enum
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:114
- alternative: an OpenApiCustomizer emitting `enum: [5, 10, 20]` as integers
- confidence: 0.7
- why: springdoc writes annotation enums as strings, which made an invalid integer schema and a string type in api-types.ts. A customizer is more code for one parameter.

### Add Owner always visible, also while loading or failed
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:66
- alternative: show it only after a successful load, as before
- confidence: 0.8
- why: the spec says Add Owner must remain available across loading, empty and error states, and creating an owner needs no list data.

### Empty `lastName` is omitted; page, size and sort always sent
- file: petclinic-frontend/src/app/owners/owner.service.ts:28
- alternative: send only the parameters that differ from API defaults
- confidence: 0.85
- why: an explicit request is self-describing in traces and logs. An empty prefix is the API default anyway, so leaving it out changes nothing.
