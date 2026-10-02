---
base: b12c9bdb53b66c0f86b25bc07c2f4b55a76f9e04
audited-base: b12c9bdb53b66c0f86b25bc07c2f4b55a76f9e04
audited-head: 3c2409a692ee72b65e139ae8db10f11415cf0c72
implementation: 3c2409a692ee72b65e139ae8db10f11415cf0c72
head: 3c2409a692ee72b65e139ae8db10f11415cf0c72
reviewers: 4 read-only Sonnet subagents (correctness, security, tests, ticket-fit) + CI/SonarCloud
harness: claude-code
session: 65ffb2df-f8d2-422b-9b25-d903ef7400e9
fixed-in: HEAD
---

## Fixed

### Raw request values echoed into the log and the 400 body
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:91
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerListRequest.java:32
- source: security reviewer
- severity: medium
- observation: The type-mismatch handler and the sort validation put the caller's raw value into `log.warn` and the ProblemDetail. A `page=1%0AFORGED` forges a log line, and a multi-KB `sort` is reflected back.
- fix: name only the parameter and the allowed values; `rejectedValueIsNotEchoed` pins page, size and sort.
- fixed-in: HEAD

### New app-wide 400 for malformed parameters had no test outside owners
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerTest.java:121
- source: tests reviewer
- severity: medium
- observation: The type-mismatch handler also turns `/api/owners/abc` (and every other endpoint) from 500 into 400. Only the owner-list tests exercised it.
- fix: pin `GET /api/owners/abc` → 400 with the non-echoing detail.
- fixed-in: HEAD

### A failed page hid the grid and paginator, leaving no way to retry
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:104
- source: correctness reviewer, ticket-fit reviewer
- severity: low
- observation: Any error removed the table and the paginator and zeroed the total. After a transient failure on page 3, the only way back was a new search from page 0.
- fix: keep the table and the last total on error, so the paginator can retry; the error banner still shows.
- fixed-in: HEAD

### Paginator read "0 of 0" before the first answer arrived
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:60
- source: ticket-fit reviewer
- severity: low
- observation: During the initial load `totalElements` is 0. The paginator rendered "0 of 0" with every button disabled until the response landed.
- fix: render the paginator only once a page has answered.
- fixed-in: HEAD

### Strict page walk flakes when another spec adds an owner mid-walk
- file: petclinic-test/src/add-visit.dsl.ts:16
- source: correctness reviewer
- severity: low
- observation: `fetchAllOwners` throws on a duplicate or a missing owner. Playwright runs `add-owner.spec.ts` in parallel with `add-visit.spec.ts`, and its insert shifts the offsets of a walk in flight.
- fix: add-visit uses a lenient `findOwner` that stops at the first match; the strict walk stays in serial Cucumber.
- fixed-in: HEAD

### Validation literals duplicated four times in the exception advice
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:38
- source: CI (SonarCloud java:S1192)
- severity: low
- observation: The new type-mismatch handler made "Validation Error" and "Validation failed: {}" the fourth copy of each literal.
- fix: extract both into constants.
- fixed-in: HEAD

### Generic length assertion where toHaveSize reports better
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:271
- source: CI (SonarCloud typescript:S5906)
- severity: low
- observation: `expect(pending.observers.length).toBe(0)` reports only a number on failure.
- fix: use `toHaveSize(0)`.
- fixed-in: HEAD

### Injected component members not marked readonly
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:36
- source: CI (SonarCloud typescript:S2933)
- severity: low
- observation: `router` and `ownerService` are never reassigned but are not declared readonly.
- fix: mark both `private readonly`.
- fixed-in: HEAD

### Shape check throws a generic Error instead of TypeError
- file: petclinic-frontend/src/app/owners/owner.service.ts:75
- source: CI (SonarCloud typescript:S7786)
- severity: low
- observation: `requirePage` signals a wrong-type response with `new Error()`, which is too unspecific for a type check.
- fix: throw `TypeError`.
- fixed-in: HEAD

## Ignored

### Owner deleted between page query and graph fetch returns 500
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:131
- source: correctness reviewer, security reviewer, tests reviewer
- severity: low
- observation: A concurrent delete in the gap between the two SELECTs throws IllegalStateException, so the whole list returns 500 instead of skipping that owner.
- why: design.md requires surfacing a missing selected owner; the next request recovers.

### HTTP errors reported as "did not answer with a page"
- file: petclinic-frontend/src/app/error.service.ts:43
- source: correctness reviewer
- severity: medium
- observation: The reviewer claims `handleError` swallows a 400/500 into `{}`, so `requirePage` masks the real cause.
- why: wrong — handleError rethrows; the service spec asserts a 400 reaches the caller.

### Total and rows come from two queries and can disagree
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:116
- source: correctness reviewer
- severity: low
- observation: Concurrent inserts or deletes between the page and count queries make `totalElements` inconsistent with the rows shown.
- why: accepted offset-paging risk in design.md; snapshots and keyset paging are out of scope.

### Deep page numbers force a huge OFFSET scan
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerListRequest.java:26
- source: security reviewer
- severity: medium
- observation: `page=100000000&size=20` passes validation and asks Postgres for an OFFSET near 2e9 on every request.
- why: the scan stops at the table's end, so it costs no more than the count query each request already runs.

### Parameterised LIKE may not use the text_pattern_ops index
- file: petclinic-backend/src/main/resources/db/migration/V4__owner_list_indexes.sql:4
- source: tests reviewer
- severity: medium
- observation: Tests only check that the indexes exist. A generic plan for `LIKE ? ESCAPE` can seq-scan while every test stays green.
- why: query-plan checks at 100k owners are explicitly deferred; release.md says unverified.

### Unfiltered list assertion in OwnerTest narrowed to Franklin
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerTest.java:137
- source: tests reviewer
- severity: low
- observation: `getAll` now filters by last name, so it no longer guards the default, parameterless listing.
- why: OwnerListTest pins the default page, size, order and total exactly.

### Page-size reset only tested through a synthetic event
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:65
- source: tests reviewer
- severity: low
- observation: The component spec calls `onPage` directly, so Material's recalculated pageIndex from the real size select is not exercised.
- why: the Cucumber "Changing the page size" scenario drives the real select.

### City sort untested with null or blank cities
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerListRequest.java:46
- source: tests reviewer
- severity: low
- observation: City ordering is only tested with distinct, non-null cities.
- why: Owner.city is @NotEmpty; NULL ordering is consistent in both directions anyway.

### #25 status comment and Bizu notification not posted
- file: openspec/changes/paginate-sort-owners/tasks.md:31
- source: ticket-fit reviewer
- severity: medium
- observation: Task 4.4 is still open, so #25 carries no correction of the earlier "Implemented" claim and no note on the narrowed scope.
- why: outward-facing post awaits the human's approval and Bizu's handle.

### GUARDRAILS.md edit outside the ticket
- file: GUARDRAILS.md:67
- source: ticket-fit reviewer
- severity: low
- observation: The diff rewrites a guardrail bullet to describe OwnerListTest and SelectRecorder.
- why: it records knowledge drift in a doc; no guardrail tooling changed.

### Index migration added beyond what the ticket asked
- file: petclinic-backend/src/main/resources/db/migration/V4__owner_list_indexes.sql:7
- source: ticket-fit reviewer
- severity: low
- observation: Three non-concurrent CREATE INDEX statements on owners were added, briefly blocking writes at boot.
- why: specified by task 2.1; the lock cost is noted in release.md.

## Assumptions

### Malformed parameter values become 400 app-wide, not just on the list
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:87
- alternative: take page and size as strings, keeping other endpoints' 500 untouched
- confidence: 0.7
- why: idiomatic global advice; a 500 for client input was a bug anyway

### Empty sort= or size= falls back to the default
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:109
- alternative: reject an empty value with 400
- confidence: 0.6
- why: Spring treats an empty value as absent; the spec lists no empty case

### "Unrepresentable page" means an offset beyond a database int
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerListRequest.java:26
- alternative: only non-integers are unrepresentable; huge pages return an empty 200
- confidence: 0.55
- why: Spring Data otherwise throws 500 past Integer.MAX_VALUE offset

### Sort tokens are case-sensitive: NAME,asc and name,ASC rejected
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerListRequest.java:45
- alternative: accept any case, as Spring Data's own sort parsing does
- confidence: 0.65
- why: the spec says "accept only" four exact tokens

### Add Owner always visible, not only after the first load
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:68
- alternative: keep hiding it until the initial list has answered
- confidence: 0.75
- why: spec wants it reachable across loading, empty and error states

### Frontend rejects an array answer with an explicit error
- file: petclinic-frontend/src/app/owners/owner.service.ts:73
- alternative: trust the type and let an old backend render an empty grid
- confidence: 0.8
- why: a mixed deploy should fail loudly, per the breaking-rollout note

### User manual paragraph edited by hand, not regenerated
- file: user-manual/manual.md:46
- alternative: run /regen-user-manual, regenerating every page and screenshot
- confidence: 0.5
- why: one paragraph drifted; full regeneration churns unrelated screenshots
