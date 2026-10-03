---
base: eb6a0d1f58053105682bba4325dcc66f808b29f5
audited-base: eb6a0d1f58053105682bba4325dcc66f808b29f5
audited-head: a17756f3e2beea37865457b34d4ef79177980fc8
implementation: a17756f3e2beea37865457b34d4ef79177980fc8
head: a17756f3e2beea37865457b34d4ef79177980fc8
reviewers: 4 read-only Sonnet subagents (correctness, security, tests, ticket-fit) + CI/SonarCloud
harness: claude-code
session: 3dc379d0-abd8-42fb-bf62-9ee4477471ce
fixed-in: HEAD
anchors: review-commit
---

## Fixed

### Raw query input echoed into the 400 body and the warn log
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerPageRequest.java:36-42
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerPageRequest.java:52
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerPageRequest.java:61
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListTest.java:120-125
- source: security reviewer
- severity: medium
- observation: every ValidationException message appended the raw `page`/`size`/`sort` value, which the advice writes into the ProblemDetail and `log.warn`. A multi-KB or `%0a`-laden `sort` forged or flooded log lines.
- fix: constant messages naming only the allowed values, pinned by a test that the input never comes back.

### A failed page, sort or size change made the whole grid vanish
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:78
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:85-87
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:25
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:232-248
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:250-260
- source: correctness reviewer
- severity: medium
- observation: on error the component cleared rows and set `loaded=false`, hiding table and paginator, while `query` already pointed at the page that failed. Only a new search could retry.
- fix: keep the last loaded page on screen, point `query` back at it, and hide "no owners" while an error shows.

### Query budget measured only under the default Name ascending sort
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListQueryBudgetTest.java:76-78
- source: tests reviewer
- severity: medium
- observation: `sort=city,desc` and `name,desc` were never counted, so a sort-specific extra query or lazy load would pass green.
- fix: parametrize the full-page budget over size and sort.

### Generic length assertion on observer lists
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:200
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:227
- source: CI (SonarCloud typescript:S5906)
- severity: low
- observation: `expect(x.observers.length).toBe(0)` reports a bare number on failure, not the leftover subscribers.
- fix: `toHaveSize(0)`.

### Injected services not marked readonly
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:27
- source: CI (SonarCloud typescript:S2933)
- severity: low
- observation: `router` and `ownerService` are never reassigned but were declared mutable.

### Shape check threw a plain Error
- file: petclinic-frontend/src/app/owners/owner.service.ts:13
- source: CI (SonarCloud typescript:S7786)
- severity: low
- observation: a response of the wrong shape is a type failure; `new Error()` does not say so.
- fix: `new TypeError()`.

## Ignored

### Owner deleted between page query and graph fetch fails the request with 500
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:137
- source: correctness, security and tests reviewers
- severity: medium
- observation: a concurrent delete after the page SELECT makes the id-IN fetch miss an owner, and the `IllegalStateException`, with the owner id in its message, becomes a 500.
- why: the design forbids silently dropping a selected owner, openspec/changes/paginate-sort-owners/design.md:44

### Shape guard said to mute failures
- file: petclinic-frontend/src/app/owners/owner.service.ts:42
- source: correctness reviewer
- severity: info
- observation: `map(requireOwnerPage)` after `catchError` turns a malformed 200 into only a generic error.
- why: refuted. It throws, and owner.service.spec.ts "rejects an array-shaped response" proves the error surfaces.

### Page past the end leaves an empty table with no automatic fallback
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:85
- source: correctness and ticket-fit reviewers
- severity: info
- observation: after deletions the current page can be empty with `totalElements>0`. The grid does not jump back to the last page.
- why: the spec requires navigation to stay available, and the paginator does stay, openspec/changes/paginate-sort-owners/specs/owner-list/spec.md:126

### No server-side length cap on the lastName prefix
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:119
- source: security reviewer
- severity: low
- observation: only the UI's `maxlength=80` limits the prefix, so a direct call can send a huge LIKE pattern.
- why: unchanged from before this change; Tomcat's 8 KB request-header limit already bounds it.

### Deep offsets and full counts can be requested repeatedly
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerPageRequest.java:41
- source: security reviewer
- severity: low
- observation: `page=100000000&size=5` passes validation and forces a COUNT plus a large OFFSET on every call.
- why: an OFFSET scan is bounded by table size; numbered pages over keyset, design.md:62

### Every page request re-counts all matching owners
- file: petclinic-backend/src/main/java/victor/training/petclinic/repository/OwnerRepository.java:15
- source: ticket-fit reviewer
- severity: medium
- observation: at 100k owners with an empty prefix, each page, sort or size change counts every row.
- why: accepted risk, openspec/changes/paginate-sort-owners/design.md:95

### Nothing proves the new indexes are used
- file: petclinic-backend/src/test/java/victor/training/petclinic/repository/OwnerListIndexesMigrationTest.java:30
- source: tests reviewer
- severity: medium
- observation: the test asserts only the index DDL, so a planner ignoring them under LIKE…ESCAPE or the collation stays green.
- why: query-plan checks on a large dataset are deferred, openspec/changes/paginate-sort-owners/design.md:60

### Ordering fixtures are lowercase ASCII, so collation edge cases are unpinned
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListTest.java:181
- source: tests reviewer
- severity: low
- observation: mixed case or accented names may sort differently in Postgres than in the Java comparator the test builds its expectation with.
- why: ordering belongs to the DB collation; the seed-based default-page test covers mixed-case names.

### Upgrade test does not exercise the rollback claim
- file: petclinic-backend/src/test/java/victor/training/petclinic/repository/OwnerListIndexesMigrationTest.java:44
- source: tests reviewer
- severity: low
- observation: the V3→V4 test counts indexes on an empty schema; booting the old jar against V4 is never run.
- why: needs the previous jar, beyond a unit test; recorded under Assumptions instead.

### Performance at 100k owners never measured
- file: openspec/changes/paginate-sort-owners/release.md:29
- source: ticket-fit reviewer
- severity: high
- observation: the ticket's scale is ~100k owners, but no large dataset was loaded and the latency test was only compiled.
- why: deferred for budget by the proposal, openspec/changes/paginate-sort-owners/proposal.md:89

### Task 4.4 open: #25 not updated, Bizu not told
- file: openspec/changes/paginate-sort-owners/tasks.md:31
- source: ticket-fit reviewer
- severity: medium
- observation: the narrowed Name/City scope and the breaking deploy are not yet on the issue.
- why: outward-facing; waits for the human's go-ahead and Bizu's handle.

### Breaking envelope and strict 400 hit every API client
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:122
- source: ticket-fit reviewer
- severity: low
- observation: array readers, JMeter and the chatbot now get 10 rows in an envelope or a 400.
- why: the human chose the breaking contract, Q&A.md:26; JMeter only POSTs and the chatbot reads by id.

## Assumptions

### An empty page=, size= or sort= is a 400, not the default
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerPageRequest.java:33-34
- alternative: treat an empty value as omitted, the way Spring's `defaultValue` does
- confidence: 0.55
- why: the spec says non-integer pages are 400 and defaults apply "when omitted"; an empty value is present but not an integer. A client sending `size=` from an unset form field would find this strict, which is what keeps it near a coin flip.

### Paging inputs taken as Strings and parsed in code
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:120-122
- alternative: `int` parameters plus a global type-mismatch→400 handler
- confidence: 0.7
- why: a global handler would also turn today's 500 for `/api/owners/abc` into a 400, changing endpoints the spec keeps unchanged. Typed parameters would document better, which keeps this from being higher.

### A page whose offset exceeds int range is a 400
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerPageRequest.java:41-42
- alternative: answer 200 with an empty page, like any page past the end
- confidence: 0.6
- why: the spec makes "unrepresentable" pages a 400, and Spring Data would otherwise fail with a 500 on an offset over Integer.MAX_VALUE. "Unrepresentable" could equally mean only "does not fit an int".

### Allowed sizes documented in prose, not as an OpenAPI enum
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:106
- alternative: `enum: [5,10,20]`, which swagger emits as strings under `type: integer`
- confidence: 0.65
- why: a mistyped enum misleads generators more than prose does. A typed `int` parameter would fix both, but conflicts with the String parsing above.

### The frontend rejects an array-shaped 200 at runtime
- file: petclinic-frontend/src/app/owners/owner.service.ts:11-15
- alternative: trust the generated type and let a stale backend render an empty grid
- confidence: 0.75
- why: during the coordinated deploy an old backend answering with an array must look like a failure, not "no owners". Nobody asked for runtime validation.

### A failed navigation keeps the last good page instead of clearing the grid
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:85
- alternative: clear the rows and show only the error
- confidence: 0.6
- why: the spec only demands an explicit error and no inferred "no matches". Showing stale-but-labelled rows beside an error is a UX call the spec leaves open.

### Rollback relies on Flyway accepting V4 as a future migration
- file: openspec/changes/paginate-sort-owners/release.md:21-23
- alternative: ship an undo script that drops the three indexes before rolling back
- confidence: 0.7
- why: Flyway's default `*:future` lets the old jar start. A real-data deployment overriding it with `*:missing`, as application.properties suggests, would refuse to start, and that was not run.

### Sort order follows the database collation, with no explicit COLLATE
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerPageRequest.java:24-26
- alternative: `COLLATE "C"` for byte-wise order matching Java's comparator
- confidence: 0.7
- why: the design's `text_pattern_ops` index implies a locale collation is intended, and locale order is what users expect for names like Śliwiński. Untested beyond the seed, which holds it below 0.8.
