---
base: 5a97353ee5425de306846fc17181101b6470c580
audited-base: 5a97353ee5425de306846fc17181101b6470c580
audited-head: be4dd34df038f95f6ecc665ef5a1c5171a673562
implementation: be4dd34df038f95f6ecc665ef5a1c5171a673562
head: be4dd34df038f95f6ecc665ef5a1c5171a673562
reviewers: 4 read-only Sonnet subagents (correctness, security, ticket-fit, tests) + CI/SonarCloud
harness: claude-code
session: 6ad50903-93e9-46ee-bf0b-fe4770210888
fixed-in: HEAD
---

## Fixed

### A failed request left the previous page's rows under the error
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:40
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:30
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:63
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:269
- source: reviewer correctness, reviewer ticket-fit
- severity: medium
- observation: When Next or a sort fails, `owners` and `totalElements` keep the last success, so page-1 rows sit under a page-2 paginator beside the error banner.
- fix: the table and paginator render only while there is no error (`showGrid`).

### Rejected parameter values echoed raw into the log and the 400 body
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerListPaging.java:44
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:88
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListTest.java:117
- source: reviewer security
- severity: medium
- observation: `?page=x%0A…` or a long `sort` value went verbatim into `log.warn` and the ProblemDetail detail. CR/LF forge log lines, and the body reflects any markup at any length.
- fix: the messages name the parameter and what it must be, never the value it got.

### SQL budget pinned only Name ascending on full pages
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListQueryTest.java:123
- source: reviewer tests
- severity: medium
- observation: The ≤3 SELECT and hydration checks ran with the default sort on full pages only. A City sort or a partial last page could add a query unnoticed.
- fix: parameterized over name,asc / city,desc / a partly full last page under city,asc.

### SonarCloud smells on the new code
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:38
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:201
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:233
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:36
- file: petclinic-frontend/src/app/owners/owner.service.ts:67
- source: CI
- severity: low
- observation: The new handler made two literals appear four times (S1192). Length asserts should use toHaveSize (S5906), injected members can be readonly (S2933), and the shape check threw a bare Error (S7786).
- fix: constants for the two literals, toHaveSize, readonly constructor members, TypeError.

## Ignored

### Owner deleted between page query and graph fetch answers 500
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:141
- source: reviewer correctness, reviewer ticket-fit, reviewer tests
- severity: medium
- observation: A concurrent delete makes the IN fetch return fewer owners, so the size check throws and the client gets a 500. No test reaches the branch.
- why: design decision 2: surface the inconsistency, never silently drop; a retry answers consistently.

### The 500 message carries the page's owner ids
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:141
- source: reviewer security
- severity: low
- observation: `handleGeneralException` echoes the IllegalStateException message, which lists the page's owner ids, into the response.
- why: owner ids are public in every /owners/{id} URL; the echo is pre-existing for all 500s.

### Unbounded lastName prefix reaches the LIKE query
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:122
- source: reviewer security
- severity: low
- observation: A multi-KB prefix, or many deep pages, each cost a page query plus a COUNT.
- why: pre-existing search input; the endpoint stays OWNER_ADMIN-only and V4 indexes the prefix.

### Empty `size=` or `page=` falls back to the default
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:124
- source: reviewer ticket-fit
- severity: low
- observation: `?size=&page=` answers 200 with size 10, page 0 instead of 400.
- why: Spring treats an empty value as omitted; the spec defaults omitted parameters.

### OpenAPI advertises every size from 5 to 20
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:113
- source: reviewer ticket-fit
- severity: low
- observation: `minimum: 5, maximum: 20` lets generated clients send 6..19, which the server rejects.
- why: swagger emits the enum as strings, which Spectral rejects; the description says 5, 10 or 20.

### Page-size reset could disagree with the paginator
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:58
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:139
- source: reviewer correctness
- severity: info
- observation: The reset to page 0 relies on `event.pageSize !== this.pageSize`, which the reviewer thought could drift after an error.
- why: `pageSize` changes only in onPage and is bound back; the size-change test pins page 0.

### Sort arrow lost after the zero-result view recreates the table
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:32
- source: reviewer correctness
- severity: info
- observation: `*ngIf` destroys matSort and the headers on zero matches, so state might not come back on the next search.
- why: matSortActive and matSortDirection are bound from component state, so they are re-applied on creation.

### Release notes and GUARDRAILS row were not asked for
- file: openspec/changes/paginate-sort-owners/release.md:1
- file: GUARDRAILS.md:30
- source: reviewer ticket-fit
- severity: info
- observation: The diff adds a rollout document and a guardrail row; task 4.4 (#25 comment) is unchecked.
- why: task 5.3 asks for the release notes; AGENTS.md demands drifted knowledge be updated. 4.4 awaits the human.

### supportedSorts asserts only the page size
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListTest.java:135
- source: reviewer tests
- severity: info
- observation: A swapped direction or a half-applied chain would keep the test green.
- why: OwnerListQueryTest.java:82 traverses all four sorts across pages and checks the full order.

### Browser sort scenarios take the API as their oracle
- file: petclinic-test/src/owner-search.feature.glue.ts:113
- source: reviewer tests
- severity: low
- observation: If the backend ignored the direction, the grid and the oracle would agree and the scenario would pass.
- why: backend order is pinned in OwnerListQueryTest; this layer pins what the grid requests and renders.

### Ordering fixtures are ASCII, so collation is untested
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListQueryTest.java:55
- source: reviewer tests
- severity: low
- observation: Accented or mixed-case names sort differently in Postgres and in Java's compareTo, so the comparator oracle would disagree.
- why: deliberately so the Java oracle holds; collation order belongs to Postgres, not to this change.

### OwnerTest.getAll no longer pins the unfiltered list
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerTest.java:130
- source: reviewer tests
- severity: info
- observation: Narrowed to `lastName=Franklin`, so a regression on the multi-owner default page would pass there.
- why: OwnerListTest.java:52 pins the unfiltered first page exactly, ten names in order.

## Assumptions

### A page whose row offset overflows an int is a 400
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerListPaging.java:39
- alternative: answer 200 with an empty page for any int page
- confidence: 0.6
- why: the spec calls "unrepresentable" pages a 400 and JPA cannot take the offset. But it also says pages beyond the last are 200, and an int page is arguably valid.

### Unconvertible parameters are a 400 app-wide, not just here
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:85
- alternative: a handler scoped to the owner list, leaving other endpoints at 500
- confidence: 0.75
- why: a type mismatch is a client error everywhere, and the global advice is the house style. It still changes other endpoints' status nobody asked about.

### Dropped the unpaged findByLastNameStartingWith
- file: petclinic-backend/src/main/java/victor/training/petclinic/repository/OwnerRepository.java:15
- alternative: keep the List overload beside the paged one
- confidence: 0.85
- why: its only production caller was the list. Leaving it invites loading 100k owners again; one test adapted.

### The frontend treats an array answer as an error
- file: petclinic-frontend/src/app/owners/owner.service.ts:65
- alternative: trust the typed response and render whatever arrives
- confidence: 0.7
- why: during a mixed deploy an old backend would otherwise show "no owners", which the spec forbids. It is a runtime check the rest of the codebase never does.

### After a failure, retry is through Find Owner
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:30
- alternative: keep rows marked stale, or add a dedicated Retry button
- confidence: 0.55
- why: stale rows mislead, as two reviewers showed, and the spec names no retry control. Hiding the paginator and headers removes paging and sorting as retry paths.

### Every request carries page, size and sort explicitly
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:82
- alternative: send only the values that differ from the API defaults
- confidence: 0.9
- why: one request shape for every action keeps tests and traces simple; the backend defaults stay the source of truth for other clients.

### Add Owner shows from the first paint, while loading too
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:70
- alternative: show it only after the first answer, as the old grid did
- confidence: 0.8
- why: the spec wants it across loading, empty and error layouts. The old gating looked accidental, not required.

### Angular's default codec encodes the prefix well enough
- file: petclinic-frontend/src/app/owners/owner.service.ts:24
- alternative: a strict encodeURIComponent codec for HttpParams
- confidence: 0.85
- why: verified it encodes `+ & % #` and spaces; the `=` and `?` it leaves raw parse correctly server-side.

### An empty page of a nonzero total says "No owners on this page."
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:56
- alternative: jump to the last valid page automatically
- confidence: 0.65
- why: the spec requires navigation to stay available and forbids "no matches". Auto-jumping would send a request the user never asked for.
