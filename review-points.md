---
base: eb6a0d1f58053105682bba4325dcc66f808b29f5
audited-base: eb6a0d1f58053105682bba4325dcc66f808b29f5
audited-head: d5d2c0932772e8659fab8543aa8cc68cafb3235f
implementation: d5d2c0932772e8659fab8543aa8cc68cafb3235f
head: d5d2c0932772e8659fab8543aa8cc68cafb3235f
reviewers: 4 read-only Sonnet subagents (correctness, security, tests, ticket-fit) + SonarCloud
harness: claude-code
session: cb79afb7-9f63-469f-bd24-e6949273c069
fixed-in: HEAD
anchors: review-commit
---

## Fixed

### A page past the int row offset answered 500, not 400
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerListPaging.java:31-34
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListTest.java:117-118
- source: correctness, security and ticket-fit reviewers
- severity: medium
- observation: only `page < 0` was rejected; `page=2147483647` made Spring Data throw "Page offset exceeds Integer.MAX_VALUE", which the catch-all handler turned into a 500.
- fix: reject any page whose row offset exceeds Integer.MAX_VALUE for the requested size.

### Attacker-chosen parameter values written raw into the log
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:91-92
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerListPaging.java:42
- source: security reviewer
- severity: low
- observation: the type-mismatch handler logged `ex.getValue()` and the sort error echoed the raw `sort`; a `%0d%0a` in either forges log lines.
- fix: log only the parameter name, and drop the raw sort value from the message.

### The global 400 for malformed parameters was pinned only on the owners list
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerTest.java:120-124
- source: tests reviewer
- severity: medium
- observation: the new handler also turns `/api/owners/abc` from 500 into 400, and no test said so.
- fix: a test pins `GET /api/owners/abc` to 400.

### Page sizes between and above the allowed ones were untested
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListTest.java:109-111
- source: tests reviewer
- severity: low
- observation: only 7, 0, -5 and abc were rejected in tests, so a 5..20 range check or a clamp would have passed.
- fix: 15, 21 and 100 are asserted to be 400 too.

### Query budget measured only on the first page
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListQueryTest.java:147-152
- source: tests reviewer
- severity: low
- observation: the OFFSET path and the partial last page had no statement-count assertion, so an N+1 there would stay green.
- fix: the budget test also runs page 3 of size 5 and the partial last page of size 20.

### E2E sort step waited for the rows to change, not for its answer
- file: petclinic-test/src/owner-search.feature.glue.ts:88-94
- source: tests reviewer
- severity: low
- observation: a row change from anywhere satisfied the step, so the second City click could race the first answer.
- fix: wait for the `/api/owners` response the click sends.

### Validation literals duplicated four times
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:38-39
- source: CI (SonarCloud java:S1192)
- severity: low
- observation: the new handler made "Validation Error" and "Validation failed: {}" the fourth copy each.
- fix: two constants.

### Generic length assertions in the component spec
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:229
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:276
- source: CI (SonarCloud typescript:S5906)
- severity: low
- observation: `expect(x.length).toBe(n)` reports a bare number on failure instead of the collection.
- fix: `toHaveSize`.

### Injected services not marked readonly
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:27
- source: CI (SonarCloud typescript:S2933)
- severity: low
- observation: `router` and `ownerService` are never reassigned but were mutable.
- fix: `private readonly`.

## Ignored

### Owner deleted between the page and graph queries answers 500
- file: petclinic-backend/src/main/java/victor/training/petclinic/repository/OwnerRepository.java:39-40
- source: correctness reviewer
- severity: low
- observation: a concurrent delete between the two queries makes `orElseThrow` fail the whole list.
- why: chosen in design: surface the inconsistency, never drop it — openspec/changes/paginate-sort-owners/design.md:44

### `+` in the last-name prefix is read as a space
- file: petclinic-frontend/src/app/owners/owner.service.ts:29
- source: correctness and ticket-fit reviewers
- severity: info
- observation: HttpParams was said to leave `+` unencoded, so Spring would decode it to a space.
- why: refuted — petclinic-frontend/src/app/owners/owner.service.spec.ts:78 asserts `%2B` on the wire and passes.

### Paginator moves before the new rows arrive
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:57
- source: correctness reviewer
- severity: low
- observation: the range label shows the new page while the old rows are still on screen.
- why: lasts one round trip; `aria-busy` marks the table meanwhile.

### A failed page load hides the grid; retry restarts at page 0
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:22
- source: correctness reviewer
- severity: low
- observation: after an error the table and paginator disappear, so only Find Owner, back on page 0, retries.
- why: error view kept apart from results — openspec/changes/paginate-sort-owners/design.md:74

### `lastName` has no server-side length cap
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:103
- source: security reviewer
- severity: low
- observation: a multi-kilobyte prefix reaches the LIKE and count queries; the UI's maxlength is client-side.
- why: unchanged from before; search matching is out of scope — openspec/changes/paginate-sort-owners/proposal.md:88

### Default-order test takes its expected order from the database
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListTest.java:55
- source: tests reviewer
- severity: low
- observation: expected ids come from the same ORDER BY, so a collation-dependent mistake would not show.
- why: collation is Postgres's call; OwnerListQueryTest pins the chain and tie-breaks independently.

### Empty page past the end keeps an active paginator
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:25
- source: tests reviewer
- severity: info
- observation: a page index past the last page shows an empty table with the paginator still active.
- why: required — openspec/changes/paginate-sort-owners/specs/owner-list/spec.md:123

### Huge but addressable page numbers still run a large OFFSET
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerListPaging.java:32
- source: ticket-fit reviewer
- severity: low
- observation: `page=1000000` passes validation and makes the database skip that many rows.
- why: past-the-end must answer 200 empty — openspec/changes/paginate-sort-owners/specs/owner-list/spec.md:34

### Issue #25 not updated, Bizu not notified
- file: openspec/changes/paginate-sort-owners/tasks.md:31
- source: ticket-fit reviewer
- severity: low
- observation: task 4.4 is still open: the scope note and the notification were never published.
- why: publishing to GitHub awaits the human's go-ahead and Bizu's handle.

## Assumptions

### Malformed parameters answer 400 on every endpoint, not only the owners list
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:87-95
- alternative: scope the handler to the owners list, leaving other malformed ids at 500
- confidence: 0.6
- why: The ticket only asked for 400 on bad page/size/sort, and a global handler is the idiomatic place for that. What holds this down: it quietly changes `/api/owners/abc` and every other endpoint, which nobody asked for.

### A failed request hides the table and paginator rather than keeping stale rows
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:22-25
- alternative: keep the previous rows and paginator visible under the error
- confidence: 0.55
- why: The spec only says an error must not look like "no matches"; hiding the grid makes that unmistakable. It is a coin flip on UX, since stale rows plus a banner would let the user retry in place.

### `sort` is one `key,direction` string; Spring's join of repeated params is accepted
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerListPaging.java:39-42
- alternative: read every `sort` value and reject repeats
- confidence: 0.7
- why: Spring joins `sort=name&sort=asc` into `name,asc`, which then passes. Rejecting it would cost a raw servlet read, and the design only demands rejecting multiple sort expressions, which still fail.

### Add Owner is always visible, also while loading or after an error
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:63
- alternative: show it only once the first page has loaded, as before
- confidence: 0.8
- why: The design asks that Add Owner stay available across the loading, empty and error layouts. The old gating on the first response had no purpose left.

### `size` is documented as an int from 5 to 20 with the list in prose, not an enum
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:107-108
- alternative: a custom springdoc customizer emitting an integer enum [5,10,20]
- confidence: 0.75
- why: springdoc writes `allowableValues` on an int as string enums (an invalid schema) and drops the default. A range plus prose stays valid and keeps the default; the server still rejects 15.

### Page-then-graph fetch lives as a default method on the repository
- file: petclinic-backend/src/main/java/victor/training/petclinic/repository/OwnerRepository.java:32-41
- alternative: a private method in OwnerRestController
- confidence: 0.8
- why: There is no service layer, and the two queries only make sense together, so the repository keeps them cohesive and the controller thin.

### The search sends the typed prefix untrimmed
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:47
- alternative: trim surrounding whitespace before searching
- confidence: 0.7
- why: The ticket keeps search semantics unchanged and the old screen did not trim either. A trailing space now silently matches nothing, as it did before.

### Fixture owners found by paging; `page` sent only after the first page
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/AddVisitApiTest.java:107-111
- alternative: always send `page=0`, or filter by a known last name
- confidence: 0.85
- why: The traced diagram of this test stays the same `GET /api/owners` as long as the first page has an owner with a pet, which the seed guarantees.
