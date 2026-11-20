---
base: d3efe6d97f03fdf2f2d07c4bde01e5b131630dd9
audited-base: d3efe6d97f03fdf2f2d07c4bde01e5b131630dd9
audited-head: 6cebbda47b5ca3f2f2a188fbfb79ab8fecc3d460
implementation: babafe2806186106677a8ba3031404ca0f5967a9
head: 6cebbda47b5ca3f2f2a188fbfb79ab8fecc3d460
reviewers: 4 read-only reviewers (correctness, security, ticket-fit, tests) on Claude Fable 5.2 (effort: high); /code-review xhigh; /simplify (4 agents); SonarCloud
harness: claude-code
session: 46aa1687-ac21-4516-ba46-73cd658e7ff5
fixed-in: HEAD
anchors: review-commit
---

## Fixed

### openapi.yaml lacked the new page maximum
- file: openapi.yaml:209
- source: pre-push hook
- severity: low
- observation: the guardrail regenerates the contract from the controller; the `@Max` on page added a `maximum` the committed file did not have, so the push was refused.
- fix: committed the regenerated openapi.yaml.

### A huge page number answered 500 instead of 400
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:60
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:104
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerTest.java:369
- source: correctness, security, ticket-fit, tests, /code-review xhigh
- severity: medium
- observation: `page` had only `@Min(0)`; past `Integer.MAX_VALUE / size` Spring Data throws on the int offset and the catch-all advice answers 500, logging a stack trace per request.
- fix: `@Max(MAX_PAGE)`, the last page whose offset fits at size 20, so it becomes a 400 like any invalid page.

### Search on the URL already shown did nothing, so no retry
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:41
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:47
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:77
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:112
- source: correctness, tests, /code-review xhigh
- severity: medium
- observation: `searchByLastName` only navigated; the router ignores a navigation to the current URL, so after a failed load Search could not retry and the error stayed until F5.
- fix: a `reload$` subject joined with the query params, pushed when the search would not change the URL.

### A page past the end showed a header-only table and "991 – 1000 of 12"
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:104-108
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:121
- source: correctness, ticket-fit, tests, /code-review xhigh
- severity: medium
- observation: a stale or shared link to page 99 rendered no rows, no message and an impossible paginator range.
- fix: when the page comes back empty past the last one, replace the URL with the last page.

### The empty message named the search still loading
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:22
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:38
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:112
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:136
- source: correctness, tests
- severity: low
- observation: the message read `query.lastName`, which changes before the answer lands, so a slow search claimed "No owners … Pot" while the old empty result was shown.
- fix: the message shows `shownLastName`, set only when a page is displayed.

### A sort or page click wiped the text typed but not searched
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:96
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:129
- source: correctness, /code-review xhigh
- severity: low
- observation: `startLoading` reset the search box from the URL on every load, so typing "Pot" and then clicking City lost "Pot".
- fix: the box is reset only when the URL's lastName changes.

### No test pinned the page-size change keeping the first owner on screen
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:145
- source: tests
- severity: medium
- observation: `onPage` could send page 0 on a size change and every test stayed green.

### The size whitelist was tested with values a range check also rejects
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerTest.java:369
- source: tests
- severity: low
- observation: only 1000, 0 and abc were tried, so `size >= 1 && size <= 100` would pass; size 7 now must be a 400.

### The batch-fetch comment promised one visits query per page
- file: petclinic-backend/src/main/resources/application.properties:15
- source: /code-review xhigh
- severity: low
- observation: batching stops at 100 pets, so a page with more pets runs a second visits query.

### The user manual still said the list shows every owner
- file: docs/user-manual/manual.md:46
- source: /code-review xhigh
- severity: low
- observation: the grid now shows a page at a time, as Last, First; the manual described the old full list.

### SORTS searched with Array.includes
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:11
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:22
- source: CI (SonarCloud typescript:S7776)
- severity: info
- observation: a whitelist membership check reads clearer and faster as a Set.

### Batch sizes were tied to the grid's page sizes
- file: petclinic-backend/src/main/resources/application.properties:16
- source: /simplify altitude
- severity: medium
- observation: `@BatchSize(20)` on Owner.pets was sized by the UI's largest page; a 50-row page would bring back one query per owner.
- fix: one global `default_batch_fetch_size=100`, the annotations removed.
- fixed-in: 6cebbda4

### An empty search still filtered with LIKE '%'
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:113-115
- source: /simplify efficiency
- severity: low
- observation: the count of every unfiltered page ran a LIKE '%' over 100k owners instead of a plain count.
- fix: a blank lastName pages through `findAll`.
- fixed-in: 6cebbda4

### OwnerSort rebuilt its param and Sort on every call
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerSort.java:18-19
- source: /simplify simplification
- severity: low
- observation: each constant split column and direction, then re-joined them and branched on `"city"`.
- fix: each constant carries its param string and its Sort.
- fixed-in: 6cebbda4

### Two 400 handlers repeated the same five lines
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:91
- source: /simplify reuse
- severity: low
- observation: the new type-mismatch handler copied the validation handler's log, ProblemDetail and errors list.
- fix: one `badRequest` helper.
- fixed-in: 6cebbda4

## Ignored

### A NUL byte in lastName gets a 500 that echoes the SQL
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:102
- source: security
- severity: medium
- observation: `?lastName=%00` makes Postgres fail and the catch-all handler returns the exception message, SQL included.
- why: the catch-all echoes every endpoint's exception; a separate fix for all of them.

### Far-out pages cost a full index walk plus a count
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:104
- source: security
- severity: low
- observation: looping page=107374182 returns empty pages that each walk the whole index, about 45 ms at 100k.
- why: deep offsets accepted in openspec/changes/archive/2026-11-20-paginate-owners-grid/design.md:169

### Owner detail's Back button drops the grid's page and sort
- file: petclinic-frontend/src/app/owners/owner-detail/owner-detail.component.ts:28
- source: ticket-fit, /code-review xhigh
- severity: low
- observation: `gotoOwnersList` navigates to bare /owners, so the in-page Back resets search, page and sort.
- why: predates this change; the browser's Back restores the grid, as the spec requires.

### The global batch size departs from the designed @BatchSize(20)
- file: petclinic-backend/src/main/resources/application.properties:16
- source: ticket-fit
- severity: info
- observation: design D3 asked for a batch on Owner.pets only; now every lazy collection batches and a page costs 4 queries.
- why: a deliberate /simplify change; the 4 queries are pinned by OwnerListingQueryCountTest.java:56

### Cut-off cells have no tooltip with the full value
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.css:44
- source: ticket-fit
- severity: medium
- observation: an address or pet list ending in "…" cannot be read in full anywhere on the grid.
- why: house rule bans native title; the app has no tooltip component yet.

### Four UI changes were not in the ticket or the approved spec
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:30
- source: ticket-fit
- severity: info
- observation: Last, First names, Search with icons, Add Owner on the search row and the ellipsis were not in issue #25.
- why: the human asked for each here; recorded in openspec/specs/owners-grid/spec.md:89

### The error banner prints "[object Object]"
- file: petclinic-frontend/src/app/error.service.ts:30
- source: correctness, /code-review xhigh
- severity: low
- observation: the shared HttpErrorHandler interpolates the parsed ProblemDetail, so the grid's banner reads `body "[object Object]"`.
- why: pre-existing shared handler; every screen uses it, so a separate fix.

### Sort and size whitelists are typed by hand in several places
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:108
- source: /code-review xhigh, /simplify altitude
- severity: low
- observation: the allowable values, OwnerSort and the frontend's SORTS list repeat the same strings with nothing keeping them in sync.
- why: explicit parameters chosen in openspec/changes/archive/2026-11-20-paginate-owners-grid/design.md:54

### OwnerSort repeats the DEFAULT string
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerSort.java:21
- source: CI (SonarCloud java:S1192)
- severity: info
- observation: "name,asc" appears both as NAME_ASC's param and as DEFAULT.
- why: an enum constant cannot read a static field; the annotation needs a constant.

### The e2e helper checks only the first 20 namesakes
- file: petclinic-test/src/support/owner-api.ts:27
- source: /code-review xhigh
- severity: info
- observation: `ensureOwnerExists` looks up namesakes on one page and could create a duplicate.
- why: it searches the full last name, e.g. Woodward; never near 20 matches.

## Assumptions

### A page whose row offset overflows is invalid, not merely past the end
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:60
- alternative: answer 200 with an empty page and the real total
- confidence: 0.55
- why: the spec says a page past the end is an empty 200 and an invalid page a 400; nobody can reach page 107 million by paging, so I read it as a hand-made URL. A reviewer reading the spec literally would pick the empty 200.

### A stale link past the end jumps to the last page
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:105
- alternative: stay on the empty page and show a "no owners on this page" message
- confidence: 0.6
- why: the URL is replaced, so Back still works, and the user sees owners instead of a dead end. A message would keep the link honest, but no one has asked for that.

### Sort and page clicks apply to the searched name, not the typed one
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:96
- alternative: a sort or page click also submits the text typed in the box
- confidence: 0.7
- why: only Search submits, as before; the grid always matches its URL. Submitting on sort would surprise someone who was half-way through typing.
