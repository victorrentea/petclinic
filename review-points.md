---
base: eb6a0d1f58053105682bba4325dcc66f808b29f5
audited-base: eb6a0d1f58053105682bba4325dcc66f808b29f5
audited-head: 6f4acaf779ac1e0e388fd16ce6fd7aca0aad4c4f
implementation: 6f4acaf779ac1e0e388fd16ce6fd7aca0aad4c4f
head: 6f4acaf779ac1e0e388fd16ce6fd7aca0aad4c4f
reviewers: 4 read-only subagents (sonnet), one per brief: correctness, security, tests, ticket-fit
harness: claude-code
session: 2ace1c98-4115-4920-97ef-23ecd51afb20
fixed-in: HEAD
anchors: review-commit
---

## Fixed

### Glue line over the 119-char limit blocked the push
- file: petclinic-test/src/owner-search.feature.glue.ts:130-133
- source: pre-push hook
- severity: low
- observation: `scripts/check-line-length.py` refused the push: a step definition line was 122 chars.
- fix: wrapped the step callback onto its own lines.

### Owner deleted mid-listing turned the whole page into a 500
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:132-135
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListConcurrentDeleteTest.java:30-41
- file: openspec/changes/paginate-sort-owners/design.md:44
- source: correctness reviewer, tests reviewer
- severity: medium
- observation: an owner deleted between the page query and the graph fetch made `orElseThrow` raise an IllegalStateException, so a routine race failed the entire list with HTTP 500.
- fix: vanished owners are filtered out of the page; a unit test stages the race and the design line now says so.

### A failed page hid the paginator, stranding the user
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:29-31
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:277-291
- source: correctness reviewer, tests reviewer
- severity: medium
- observation: on an error both table and paginator disappeared, so the only way out was Find Owner, which drops the page and position; no test covered recovery.
- fix: only the table hides on error; the paginator stays, and a test retries a page after a failure.

### Array-shaped response rendered as a silently blank grid
- file: petclinic-frontend/src/app/owners/owner.service.ts:33-39
- file: petclinic-frontend/src/app/owners/owner.service.spec.ts:105-114
- source: tests reviewer
- severity: medium
- observation: a backend still on the array contract yields undefined `content`/`totalElements`; the grid showed nothing and no error, and no test rejected an array.
- fix: the service errors when the body has no `content` array, surfaced as the explicit failure message.

### Page past the end showed bare headers with no explanation
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:57
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:272
- source: correctness reviewer
- severity: low
- observation: with `totalElements > 0` and empty `content` (owners deleted under the current page) the table rendered only its header row.
- fix: an empty page of a nonzero total says so and points back to an earlier page.

### Paginator's own reset after a size change was unpinned
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:151
- source: tests reviewer
- severity: low
- observation: the size-change test only checked the request carried page 0, not that the paginator's index and range label reset too.
- fix: asserts the range label reads `1 – 20 of 26` after switching size.

## Ignored

### Breaking envelope instead of the array contract
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:108
- source: ticket-fit reviewer
- severity: low
- observation: external clients expecting an array break; only 10 owners come back without paging.
- why: the human chose the breaking envelope, `Q&A.md:26`.

### Paging state lost after visiting an owner and coming back
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:21-25
- source: ticket-fit reviewer, correctness reviewer
- severity: low
- observation: page, size, sort and filter reset to defaults when the list component is recreated.
- why: the spec keeps page state local, out of the URL: `specs/owner-list/spec.md:95`.

### Add Owner now visible while loading and on error
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:66
- source: ticket-fit reviewer
- severity: info
- observation: the button used to appear only after data arrived; now it is always rendered.
- why: required by `openspec/changes/paginate-sort-owners/design.md:74`.

### Unrequested V4 indexes add schema and rollback burden
- file: petclinic-backend/src/main/resources/db/migration/V4__owner_list_indexes.sql:4-8
- source: ticket-fit reviewer
- severity: low
- observation: the ticket asks for a paginated, sortable grid; three indexes are verified only on small fixtures.
- why: planned in `Q&A.md:53` and `openspec/changes/paginate-sort-owners/design.md:52`; additive, rollback-safe.

### Sorting rejects Address, Telephone and Pets despite "any column"
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerListRequest.java:18
- source: ticket-fit reviewer
- severity: info
- observation: only four sort tokens and sizes 5/10/20 are accepted; everything else is a 400.
- why: the human narrowed sorting to Name and City, `Q&A.md:29`.

### Page, count and graph queries share no snapshot
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:120
- source: correctness reviewer
- severity: low
- observation: concurrent writes between the statements can make `totalElements` disagree with `content` or shift owners across pages.
- why: accepted risk, `openspec/changes/paginate-sort-owners/design.md:92`.

### Rejected page/size/sort value echoed in the 400 detail
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerListRequest.java:36
- source: security reviewer
- severity: low
- observation: an invalid value is reflected verbatim in the ProblemDetail and the frontend alert.
- why: same as existing validation errors; Tomcat caps the URL, Angular escapes interpolation.

### lastName has no server-side length cap
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:110
- source: security reviewer
- severity: low
- observation: only the UI's `maxlength=80` bounds the prefix; the LIKE and count run with any length.
- why: unchanged from before this change; Tomcat's request-line limit bounds it.

### Paging loop can be scripted cheaply by unauthenticated clients
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:59
- source: security reviewer
- severity: info
- observation: each request runs a COUNT and a graph fetch; a client can loop over pages.
- why: refuted: the class stays behind `hasRole(OWNER_ADMIN)`, not open to unauthenticated clients.

### Latency test tightened to exactly 10 but never run
- file: petclinic-backend/src/test/java/victor/training/petclinic/perf/OwnerSearchThroughLatencyProxyTest.java:57
- source: tests reviewer
- severity: low
- observation: `hasSize(10)` fails on fewer than 10 owners, and the new envelope path was only compiled.
- why: the old assertion also required ten owners; running it was deferred by task 2.3.

### Ordering fixtures are ASCII, blind to collation
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListTest.java:56
- source: tests reviewer
- severity: info
- observation: the budget test's `Zq…` names cannot catch an ORDER BY or collation mismatch for accented names.
- why: refuted: OwnerListTest checks the seeded Śliwiński/Mureșan rows against the database's own ORDER BY.

## Assumptions

### An empty page, size or sort value is a 400, not the default
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerListRequest.java:32-36
- alternative: treat `size=` like an omitted parameter and apply the default
- confidence: 0.55
- why: the spec defaults only omitted parameters and calls malformed input a 400; an empty value reads as malformed. Nothing settles which side `size=` falls on, and Spring's own `defaultValue` would have picked the other.

### "Unrepresentable page" means an offset that overflows an int
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerListRequest.java:46-52
- alternative: accept any int page and let the database return an empty page
- confidence: 0.75
- why: Spring Data passes the offset to JDBC as an int, so `page × size` past `Integer.MAX_VALUE` would 500. Rejecting it as 400 matches the spec's wording, though a looser reading could cap at int pages only.

### Repeated sort parameters are rejected, not first-wins
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerListRequest.java:57-58
- alternative: honour the first `sort` value and ignore the rest
- confidence: 0.8
- why: the spec rejects "multiple sort expressions"; Spring joins repeats with a comma, which fails the whitelist. Only a client sending two sorts by accident would prefer first-wins.

### One getOwners(query) replaces getOwners() and searchOwners()
- file: petclinic-frontend/src/app/owners/owner.service.ts:23-27
- alternative: keep `searchOwners` as a thin delegate to the shared query builder
- confidence: 0.85
- why: the list component was their only caller, and the design allows one entry point. A delegate would keep a second name for one request.

### OpenAPI documents size's 5/10/20 in prose, not as an enum
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:113-115
- alternative: emit an integer enum, hand-patching the generated `openapi.yaml`
- confidence: 0.7
- why: springdoc writes `allowableValues` as strings, which Spectral rejects as an error against the integer default. Generated TS types therefore lose the 5/10/20 constraint.

### E2E expected orders are read from the API, not hard-coded
- file: petclinic-test/src/owner-search.feature.glue.ts:54
- file: petclinic-test/src/owner-search.feature.glue.ts:114-118
- alternative: list the expected first page of seeded names in the .feature
- confidence: 0.8
- why: the database collation places names like Śliwiński, and add-owner.spec leaves `Acceptance…` owners behind that sort first. A hard-coded list would break on the shared database; the API traversal is itself checked for duplicates and gaps.

### AddVisitApiTest walks pages to find an owner with a pet
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/AddVisitApiTest.java:105-118
- alternative: filter by a known seeded last name with pets
- confidence: 0.7
- why: page traversal keeps it independent of which seeded owner has pets. It adds `?page=0` to the traced call in the sequence diagram, which a reader may find noisy.
