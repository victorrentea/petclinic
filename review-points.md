---
base: f2d2edfd6edf6f881530d6a2b2c3228824f81d30
audited-base: f2d2edfd6edf6f881530d6a2b2c3228824f81d30
audited-head: d84736518c5663122603ee0abb9c4509dc2dbc3d
implementation: d84736518c5663122603ee0abb9c4509dc2dbc3d
head: d84736518c5663122603ee0abb9c4509dc2dbc3d
reviewers: 4 read-only Plan subagents (sonnet): correctness, security, tests, ticket-fit + pre-push hook
harness: claude-code
session: 7f009e68-257f-4024-95db-31ddf1995481
fixed-in: HEAD
anchors: review-commit
---

## Fixed

### Line over 119 characters blocked the push
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:116
- file: openapi.yaml:194
- file: petclinic-frontend/src/app/generated/api-types.ts:571
- source: pre-push hook
- severity: low
- observation: after Spotless reflowed the `lastName` `@Parameter`, the line was 120 characters, and `check-line-length.py` refused the push.
- fix: shortened the parameter description, then regenerated `openapi.yaml` and `api-types.ts`.

### "No owners" message names the pending prefix, not the answered one
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:20
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:61
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:25
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:179
- source: correctness reviewer, ticket-fit reviewer
- severity: low
- observation: `query` is replaced as soon as a request starts. After a search that matched nobody, a second search briefly read 'No owners … starting with "Dav"' before "Dav" had been answered.
- fix: the message reads `shownLastName`, which is set only when a page arrives.

### Rejected request values echoed into logs and 400 bodies
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:88-89
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:152
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListTest.java:117
- source: security reviewer
- severity: low
- observation: `?page=` or `?sort=` containing a newline went verbatim into `log.warn` and into the ProblemDetail, so a caller could forge log lines.
- fix: the messages name the parameter but no longer echo its value, and a test pins that.

### No test that a later success clears an earlier error
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:192
- source: tests reviewer
- severity: low
- observation: failure was tested only on a fresh load. Nothing pinned that the next successful page clears `errorMessage` and shows the rows again.
- fix: added a spec where a failure is followed by a success.

## Ignored

### Owner deleted between page and graph queries answers 500
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:167
- source: correctness reviewer, tests reviewer
- severity: low
- observation: if a selected owner is deleted between the page SELECT and the graph SELECT, `IllegalStateException` turns the whole page into a 500.
- why: design.md decision 2 forbids silently dropping a selected owner.

### Old rows stay while loading; a failure hides the paginator
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:28
- source: correctness reviewer
- severity: low
- observation: after a header click the old rows stay until the reply arrives. If that request fails, the table and paginator disappear.
- why: the table is `aria-busy` while loading, and Find Owner retries; recorded as an assumption.

### "+" in the prefix may go out unencoded
- file: petclinic-frontend/src/app/owners/owner.service.spec.ts:78
- source: correctness reviewer
- severity: info
- observation: the reviewer suspected `HttpParams` leaves `+` raw, which the server would read as a space.
- why: refuted — this spec asserts `%2B` in `urlWithParams`, and it passes.

### Deep page offset forces billions of discarded rows
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:141
- source: security reviewer
- severity: info
- observation: `page=107374182&size=20` passes validation, supposedly making the DB skip about 2 billion rows.
- why: refuted — OFFSET stops at the end of the table, and the count query already scans every match.

### lastName prefix has no server-side length limit
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:116-117
- source: security reviewer
- severity: low
- observation: only the UI's `maxlength=80` limits the prefix, so a direct call can send kilobytes to the LIKE and count queries.
- why: unchanged from before this change; out of scope for #25.

### Raw error string shown in the alert
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:68
- source: security reviewer
- severity: low
- observation: `String(error)` from the shared `HttpErrorHandler` is shown to the user as is.
- why: the shared handler formats it, unchanged by this change; JSON bodies render only a status.

### Total shrinks under you: empty page with no way back
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:204
- source: tests reviewer
- severity: info
- observation: the reviewer claimed that a page beyond the end after concurrent deletes shows a blank table, with no test.
- why: refuted — this spec pins that the paginator stays visible with navigation back.

### Ordering test uses lowercase ASCII names only
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListTest.java:171
- source: tests reviewer
- severity: low
- observation: Java's comparator and the DB collation differ on accents and mixed case, and the fixture never shows that.
- why: deliberate — it pins the key chain; Java cannot reproduce the DB collation.

### V4 indexes checked for existence, never for planner use
- file: petclinic-backend/src/main/resources/db/migration/V4__owner_list_indexes.sql:5
- source: tests reviewer
- severity: low
- observation: a wrong operator class or column order would leave every test green while the queries run as sequential scans.
- why: a plan on 26 rows proves nothing; the ticket defers measuring at scale.

### Global type-mismatch handler changes other endpoints
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:85
- source: ticket-fit reviewer
- severity: low
- observation: `/api/owners/abc` and the like now answer 400 instead of 500, though the ticket says detail endpoints stay as before.
- why: a 500 for malformed input was a bug; recorded as an assumption below.

### Add Owner now shown during loading, empty and error states
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:64
- source: ticket-fit reviewer
- severity: info
- observation: the button used to appear only after data arrived, inside the table block.
- why: refuted — design.md decision 4 requires Add Owner in every layout, and spec line 221 pins it.

## Assumptions

### Implemented before Q5–Q15 were reviewed
- file: openspec/changes/paginate-sort-owners/proposal.md:90
- alternative: stop until Q5–Q15 are confirmed, then implement
- confidence: 0.6
- why: running /opsx-apply explicitly reads as a go-ahead. But the proposal itself says Q5–Q15 await review, and nobody confirmed them in this conversation.

### Global 400 for any malformed typed parameter
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:85
- alternative: String params parsed in the controller, so the other endpoints keep their 500
- confidence: 0.55
- why: typed `int` params give the right OpenAPI types and a 400 is the correct answer. It does, however, change the error status of endpoints the ticket said to leave alone.

### Failure hides table and paginator; retry is Find Owner
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:28
- alternative: keep the paginator on error so the same page can be retried
- confidence: 0.55
- why: the spec only asks for an explicit error that is distinct from "no matches". Hiding stale rows avoids presenting them as the answer to the failed request, at the cost of an easy retry.

### "Unrepresentable page" means an offset beyond int range
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:140-141
- alternative: reject only page numbers that do not parse as int
- confidence: 0.7
- why: Spring Data needs an int offset and would otherwise throw a 500. The spec names the term without defining it.

### Empty page, size or sort value falls back to the default
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:127
- alternative: reject `sort=`, `size=`, `page=` with 400
- confidence: 0.65
- why: Spring applies `defaultValue` to empty values, which matches the empty `lastName` meaning "all". The spec lists malformed values but says nothing about empty ones.

### Sort tokens are exact and lowercase
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:150
- alternative: accept `NAME,ASC` case-insensitively, as Spring's own Sort parsing does
- confidence: 0.7
- why: the spec enumerates exactly four tokens and tells the API to reject everything else, so strict is the literal reading.

### Previous rows stay visible while the next page loads
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:29
- alternative: clear the rows or overlay a spinner while loading
- confidence: 0.65
- why: this avoids flicker on every page click, and `aria-busy` marks the stale state. The ticket is silent on loading visuals.

### The unbounded List finder was removed
- file: petclinic-backend/src/main/java/victor/training/petclinic/repository/OwnerRepository.java:15
- alternative: keep `List<Owner> findByLastNameStartingWith(String)` beside the pageable one
- confidence: 0.85
- why: no main code used it any more, and leaving it invites the next unbounded load. Only one test needed `Pageable.unpaged()`.

### Empty last name is left out of the query string
- file: petclinic-frontend/src/app/owners/owner.service.ts:26
- alternative: always send `lastName=` even when empty
- confidence: 0.85
- why: the server treats a missing and an empty value identically, and the URL stays clean in traces.

### Page size documented as integer 5–20, not an enum
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:122
- alternative: an integer enum of 5, 10 and 20 in `openapi.yaml`
- confidence: 0.8
- why: springdoc emits string-typed enum values, which Spectral rejects as an error. The description names the three sizes.

### Manual text updated, screenshot not regenerated
- file: user-manual/manual.md:46
- alternative: re-crawl the UI with /regen-user-manual for a fresh `owners-list.png`
- confidence: 0.6
- why: the text carries the behaviour. A screenshot needs the app running and a full crawl, which was out of the task's scope.
