---
base: ad1fb1d35662f8fd94ed202fc3572f309e185dbd
audited-base: ad1fb1d35662f8fd94ed202fc3572f309e185dbd
audited-head: d21158744e03c0b1167df0eb57be9089c71b1976
implementation: d21158744e03c0b1167df0eb57be9089c71b1976
head: d21158744e03c0b1167df0eb57be9089c71b1976
reviewers: 4 read-only Sonnet reviewers (correctness, security, ticket-fit, tests) + CI/SonarCloud
harness: claude-code
session: 1c2f57a0-d326-4ee3-931a-392042066103
fixed-in: HEAD
anchors: review-commit
ticket: victorrentea/petclinic#52
---

## Fixed

### A huge page overflowed the int offset into a 500
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitGridParams.java:41
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitGridParams.java:49
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/VisitGridTest.java:170
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/VisitGridParamsTest.java:26
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/VisitGridParamsTest.java:39
- source: correctness, security and tests reviewers
- severity: medium
- observation: `page` was clamped only to Integer.MAX_VALUE, so `page × size` overflowed the int offset JPA takes and `?page=2147483647&size=20` threw a 500 instead of serving the last page.
- fix: cap the page at `Integer.MAX_VALUE / size`, and clamp the size into [5, 20] before snapping so a huge negative size cannot overflow either.

### navigate() promise left floating
- file: petclinic-frontend/src/app/visits/visits-page/visits-page.component.ts:56
- source: CI (SonarCloud typescript:S9383)
- severity: high
- observation: `router.navigate` returns a promise nobody handled; Sonar rates it a BUG and the quality gate fails on it.
- fix: mark it explicitly ignored with `void`.

### Generic length assertion in the visits page spec
- file: petclinic-frontend/src/app/visits/visits-page/visits-page.component.spec.ts:113
- source: CI (SonarCloud typescript:S5906)
- severity: low
- observation: `expect(links.length).toBe(...)` reports worse than Jasmine's `toHaveSize`.
- fix: use `toHaveSize`.

### Sort test passed even if sorting ran after the LIMIT
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/VisitGridTest.java:142
- source: tests reviewer
- severity: medium
- observation: each column's test only checked that the 10 rows shown were in order, so a sort applied to the page instead of the table would still pass.
- fix: each case also asserts the first row is the global extreme of that column.

### Missing space in the Visit type declaration
- file: petclinic-frontend/src/app/visits/visit.ts:14
- source: ticket-fit reviewer
- severity: low
- observation: my edit left `export type Visit =Omit<`.

## Ignored

### Owner names logged at info on every grid page
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitRestController.java:57
- source: security, correctness and ticket-fit reviewers
- severity: medium
- observation: every grid request logs up to 20 owners' full names: personal data in logs, shipped to aggregators.
- why: the human asked for exactly this log line, at Q&A.md:15.

### A page past the end costs a second query
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitRestController.java:65
- source: security and ticket-fit reviewers
- severity: low
- observation: an out-of-range page runs the page and count queries, then again for the last page.
- why: happens only on stale or bad pages; serving the last page is Q&A.md:12.

### A backend failure renders as "No visits found."
- file: petclinic-frontend/src/app/visits/visit.service.ts:27
- source: correctness, ticket-fit and tests reviewers
- severity: low
- observation: `catchError` substitutes an empty page, so an outage looks like an empty clinic with no retry.
- why: the old `getVisits` swallowed errors into `[]` the same way; no error page per Q&A.md:12.

### Paginator vanishes when a page comes back empty
- file: petclinic-frontend/src/app/visits/visits-page/visits-page.component.html:9
- source: correctness reviewer
- severity: info
- observation: the table, headers and paginator hide together whenever `content` is empty.
- why: content is empty only for an empty clinic; past the end serves the last page (VisitRestController.findGridPageWithinBounds).

### Sort glue would fail on an empty database
- file: petclinic-test/src/visits-sort.feature:1
- source: correctness reviewer
- severity: info
- observation: the Then step needs 10 rows but no DB fixture appeared to be declared.
- why: refuted; the feature is tagged `@fixture:default`, which loads the 30-visit seed.

### Old list tests disabled, not replaced
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/VisitTest.java:107
- source: ticket-fit and tests reviewers
- severity: info
- observation: `getAll` and `getAll_returnsEnrichedFields` are `@Disabled`; nothing covers `findGridPage` against a database.
- why: disabling them is Q&A.md:18; VisitGridTest covers findGridPage on Zonky Postgres.

### Sorting is case- and accent-blind to linguistic order
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitGridParams.java:29
- source: ticket-fit reviewer
- severity: medium
- observation: the DB collates by code point, so uppercase sorts before lowercase and "Ștefan" after "Wendy".
- why: database collation (C.UTF-8) decides; a linguistic collation is a separate follow-up.

### The v.id tie-breaker has no test
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/VisitGridParamsTest.java:70
- source: tests reviewer
- severity: info
- observation: dropping the `v.id` tie-breaker would keep everything green.
- why: refuted; sortsByTheColumnThenByIdForAStablePaging asserts the v.id order and would fail.

### Acceptance test passes for a client-side sort too
- file: petclinic-test/src/visits-sort.feature.glue.ts:39
- source: tests reviewer
- severity: low
- observation: checking only that the first page is ordered also passes if the browser sorts 10 rows itself.
- why: Q&A.md:21 fixes this exact check; VisitGridTest pins the server-side sort.

## Assumptions

### Newest first, 10 rows by default
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitGridParams.java:21-22
- source: human
- why: Q&A.md:6 decides it.
- confidence: 1.0

### The repository selects straight into VisitRowDto
- file: petclinic-backend/src/main/java/victor/training/petclinic/repository/VisitRepository.java:23
- source: human
- why: Q&A.md:9 decides it.
- confidence: 1.0

### Bad params are corrected, never answered with 400
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitRestController.java:64-65
- source: human
- why: Q&A.md:12 decides it.
- confidence: 1.0

### Owner column sorts by first name, then last name
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitGridParams.java:29
- alternative: last name first, the usual directory order
- why: the column shows "First Last", so this order reads sorted on screen and lets the acceptance test compare
  the visible text. A clinic may still expect surname order, which keeps it near a coin flip.
- confidence: 0.6

### A size equidistant from two allowed sizes snaps down
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitGridParams.java:50-52
- alternative: 15 snaps up to 20
- why: "nearest" leaves the tie open; the stream takes the first, smaller size. Nobody types 15, so it barely matters.
- confidence: 0.5

### An unreadable page number serves the first page
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitGridParams.java:41
- alternative: treat it as past the end and serve the last page
- why: Q3 names only "past the end"; garbage reads closest to "no page given", which defaults to the first.
- confidence: 0.75

### Page, size and sort live in the URL query
- file: petclinic-frontend/src/app/visits/visits-page/visits-page.component.ts:56
- alternative: component state only, lost on reload
- why: a reload or Back keeps the front desk's place. It is not asked for, but it is cheap and fits Angular routing.
- confidence: 0.8

### The response echoes the sort it actually applied
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitRestController.java:58
- alternative: the client trusts the sort it asked for
- why: after a fallback the header arrows must show the order actually served; the echo is built only from our own constants.
- confidence: 0.85
