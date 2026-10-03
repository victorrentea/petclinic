---
base: 98cb82a7249fe9341595b3a5beb4b7a71a7f22ec
audited-base: 98cb82a7249fe9341595b3a5beb4b7a71a7f22ec
audited-head: d9233f2c0de723a330c0a64f90229329a0d50fa1
implementation: d9233f2c0de723a330c0a64f90229329a0d50fa1
head: d9233f2c0de723a330c0a64f90229329a0d50fa1
reviewers: 4 read-only Explore subagents (sonnet): correctness, security, ticket-fit, tests + pre-push hook
harness: claude-code
session: aedd93d8-4e1a-4726-9a5c-1f9e43abda37
fixed-in: HEAD
anchors: review-commit
---

## Fixed

### Lines over 119 characters blocked the push
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:109-110
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListQueryBudgetTest.java:33-34
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListTest.java:144-145
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/RecordedSql.java:8-11
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:58-59
- source: pre-push hook
- severity: low
- observation: scripts/check-line-length.py refused five added lines of 120-126 chars, so the branch could not be pushed.
- fix: wrapped each line; the parameter description text is unchanged, so openapi.yaml did not move.

### A failed list request leaves no way to retry
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:60-62
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:22-25
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:270-284
- source: correctness, ticket-fit and tests reviewers
- severity: medium
- observation: an error nulls the page, so the table, sort headers and paginator vanish; only resubmitting the search form recovers, and it resets to page 0.
- fix: a Retry button in the error alert reloads the same filter, page, size and sort.

### Caller-controlled parameter values echoed into the 400 body and the log
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerPageRequest.java:18
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerPageRequest.java:44
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerPageRequest.java:52
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerPageRequest.java:60
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerPageRequest.java:69
- source: security reviewer
- severity: medium
- observation: every ValidationException message ended in ", was <raw value>", which the advice logs with log.warn and returns as the ProblemDetail detail — an unbounded string with CR/LF forges log lines.
- fix: the messages state the rule only, never the value.

### "No owners" message names a search still in flight
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:20-21
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:82
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:27
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:241-250
- source: ticket-fit reviewer
- severity: low
- observation: the message read query.lastName, which changes on submit, while the zero-total page on screen still answers the previous search — "no owners starting with Pot" before Pot answered.
- fix: the message reads the prefix the displayed page answered, set only on success.

### Blank page, size and sort parameters are unpinned
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListTest.java:113-118
- source: tests reviewer
- severity: low
- observation: no test sent `?page=&size=&sort=`; the reviewer expected a 400, but Spring applies defaultValue to an empty value too, and nothing pinned either outcome.
- fix: a test pins that blank parameters fall back to the defaults.

### Migration test fails as soon as a V5 exists
- file: petclinic-backend/src/test/java/victor/training/petclinic/repository/OwnerListIndexesMigrationTest.java:36
- source: tests reviewer
- severity: low
- observation: the upgrade migrated to the latest version and asserted that exactly "4" was applied, so any later migration breaks it.
- fix: the upgrade step targets version 4.

## Ignored

### Owner deleted between the page query and the graph fetch returns 500
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:142
- source: correctness and tests reviewers
- severity: medium
- observation: a concurrent delete after the page query leaves an id with no fetched owner; IllegalStateException turns the whole page into a 500, and no test covers it.
- why: the design forbids silently dropping a selected owner: openspec/changes/paginate-sort-owners/design.md:44

### The 500 body carries the vanished owner's id
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:142
- source: security reviewer
- severity: low
- observation: the generic handler returns the exception message, "Owner N vanished while listing", to the client.
- why: only OWNER_ADMIN reaches this endpoint, and that role lists every owner id anyway.

### Last page left empty after concurrent deletes
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:59
- source: correctness reviewer
- severity: info
- observation: after deletes, a reload of the last page shows an empty table with a nonzero total.
- why: specified behaviour, paginator stays to go back: specs/owner-list/spec.md:123; spec test at owner-list.component.spec.ts:252.

### City sort is not the exact reverse when city is NULL
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerPageRequest.java:29-32
- source: correctness reviewer
- severity: info
- observation: NULL cities sort last ascending and first descending, so asc and desc would not mirror at the NULL boundary.
- why: refuted — Postgres NULLS LAST asc / NULLS FIRST desc is the exact mirror; city is @NotEmpty (Owner.java:42).

### No test pins where NULL cities land
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListTest.java:192
- source: tests reviewer
- severity: low
- observation: every ordering test uses non-null cities, so a change to NULL ordering stays green.
- why: city cannot be NULL through the app: @NotEmpty at petclinic-backend/src/main/java/victor/training/petclinic/domain/Owner.java:42.

### Three new indexes slow owner writes; prefix index overlaps the Name index
- file: petclinic-backend/src/main/resources/db/migration/V4__owner_list_indexes.sql:3-5
- source: correctness reviewer
- severity: low
- observation: three indexes on owners add write cost, and the text_pattern_ops index shares its leading column with the Name-order index.
- why: deliberate — text_pattern_ops serves LIKE under en_US collation: openspec/changes/paginate-sort-owners/design.md:54

### A huge page index forces a deep OFFSET plus a count per request
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerPageRequest.java:41-46
- source: security reviewer
- severity: low
- observation: page=2147483647 is accepted; each call runs a deep OFFSET scan and a count.
- why: offset paging chosen over keyset for numbered pages: openspec/changes/paginate-sort-owners/design.md:62

### Name sorts by last name while the cell shows "First Last"
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:34
- source: ticket-fit reviewer
- severity: medium
- observation: rows read "George Franklin, Betty Davis" yet sort Davis before Franklin, so the column can look unsorted.
- why: decided in the proposal, last names first: openspec/changes/paginate-sort-owners/proposal.md:11

### Unrelated Visit.java comment edit
- file: petclinic-backend/src/main/java/victor/training/petclinic/domain/Visit.java:19
- source: ticket-fit reviewer
- severity: low
- observation: the visit_time Javadoc changes from "before V4" to "before V3", outside the ticket.
- why: the new V4 is the index migration; leaving "V4" would point readers at it.

### Issue #25 comment and Bizu notification not done
- file: openspec/changes/paginate-sort-owners/tasks.md:31
- source: ticket-fit reviewer
- severity: low
- observation: task 4.4 is unchecked, so the narrowed scope and breaking rollout are not on the ticket yet.
- why: publishing on GitHub awaits the human's approval and Bizu's handle.

### OwnerTest.getAll no longer asserts the unfiltered list
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerTest.java:131
- source: tests reviewer
- severity: info
- observation: getAll now filters by Franklin, so a broken default list would pass it.
- why: refuted — the default first page is pinned against SQL in OwnerListTest.java:60.

## Assumptions

### page and size parsed from strings, not bound as ints
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerPageRequest.java:20
- alternative: int params plus a MethodArgumentTypeMismatchException → 400 handler in the advice
- confidence: 0.7
- why: binding ints sends `page=abc` to the catch-all 500 handler; a global handler would also change other endpoints' errors. A shared handler is arguably the cleaner fix, which holds this below 0.8.

### Add Owner always visible, not only after the first answer
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:70
- alternative: keep it hidden until the list has loaded, as before
- confidence: 0.6
- why: the design asks to keep it reachable in loading, empty and error layouts. The old *ngIf may have served e2e timing, though add-owner.spec.ts still passes.

### Previous rows stay on screen while the next page loads
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:29
- alternative: clear the table or show a spinner until the page answers
- confidence: 0.65
- why: avoids flicker on fast pages; only aria-busy marks the stale rows. Nothing in the spec rules either way, and a slow 100k-row page would favour a spinner.

### Paginator keeps Material's "Items per page" label
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:59
- alternative: a MatPaginatorIntl saying "Rows per page", as the sketch shows
- confidence: 0.5
- why: the proposal calls its sketch illustrative, and a custom intl provider is app-wide. A coin flip, because the sketch is the only wording the human saw.

### Angular's default HttpParams codec, leaving the comma unencoded
- file: petclinic-frontend/src/app/owners/owner.service.ts:24-28
- alternative: a strict encodeURIComponent codec, sending `sort=name%2Casc`
- confidence: 0.85
- why: the default codec already encodes + & % # and space (pinned by a test); Spring reads a raw comma correctly.

### V4 indexes created inside the migration transaction, not CONCURRENTLY
- file: petclinic-backend/src/main/resources/db/migration/V4__owner_list_indexes.sql:3-5
- alternative: CREATE INDEX CONCURRENTLY with Flyway executeInTransaction=false
- confidence: 0.6
- why: today's table has 26 rows, so the write lock is instant. At the 100k owners expected, a deploy-time lock may matter, and that pulls this down.

### Generic error text instead of the server's message
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:87
- alternative: show the message the HttpErrorHandler rethrows
- confidence: 0.75
- why: that message is "server returned code 500 with body …", written for developers rather than clinic staff.

### e2e fixtures read owner pages only until the first match
- file: petclinic-test/src/support/owners-api.ts:29
- alternative: filter by a known seeded last name
- confidence: 0.8
- why: keeps the traced add-visit flow at one list call and does not hard-code seed names. A seed with no pet owner on any page still fails loudly.
