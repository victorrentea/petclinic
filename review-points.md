---
base: 4657ba1fa1f2c5dd0c13aea8cb518537ce5566c1
audited-base: 4657ba1fa1f2c5dd0c13aea8cb518537ce5566c1
audited-head: 4bd0304528bb3439a1ddbb923bfe2e59aee90217
implementation: 4bd0304528bb3439a1ddbb923bfe2e59aee90217
head: 4bd0304528bb3439a1ddbb923bfe2e59aee90217
reviewers: 4 read-only reviewer subagents on Sonnet (correctness, security, ticket-fit, tests) + SonarCloud CI; earlier in the session /code-review xhigh and /simplify
harness: claude-code
session: a089dc03-0cdb-4c9e-acb3-4b2a1153f6e8
fixed-in: HEAD
anchors: review-commit
---

## Fixed

### Navigation promises were neither awaited nor marked ignored
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:91
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:53
- source: CI (SonarCloud typescript:S9383, BUG)
- severity: medium
- observation: `router.navigate` returns a promise nobody awaits; a failed navigation is swallowed silently, and the quality gate fails on it.
- fix: mark both calls `void`, since the grid reacts to the URL, not to the promise.

### A failed list request left the grid blank or stale, with no message
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:18
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:85
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:332
- source: correctness reviewer, tests reviewer, /code-review xhigh
- severity: medium
- observation: `catchError` stored `errorMessage` but no template rendered it. A 400 on `/owners?sort=telephone` showed an empty page, or the previous rows under a new sort header.
- fix: render the error as an alert and clear it when a page arrives.

### Back on the owner page dropped the grid's page and order
- file: petclinic-frontend/src/app/owners/owner-detail/owner-detail.component.ts:33
- file: petclinic-frontend/src/app/owners/owner-detail/owner-detail.component.spec.ts:114
- source: /code-review xhigh
- severity: medium
- observation: `gotoOwnersList` navigated to bare `/owners`, so the page's own Back button landed on page 1 by name. The spec requires the grid to restore its place.
- fix: go back in history when the page was reached inside the app, as pet-edit already does.

### The page dropdown recomputed its selection once per option
- file: petclinic-frontend/src/app/design-system/combo.component.ts:40
- file: petclinic-frontend/src/app/design-system/combo.component.ts:86
- source: tests reviewer, /code-review xhigh
- severity: medium
- observation: at 50,000 owners and 5 per page the pager lists 10,000 ranges. `[selected]` called the `selectedIndex` getter, an O(n) scan, for every option on every change detection: O(n²) per pass, twice.
- fix: keep the selected index in a field, recomputed only when the value or the options change.

### Nothing failed if V4's sort indexes were dropped
- file: petclinic-backend/src/test/java/victor/training/petclinic/repository/OwnerSortCollationTest.java:69
- source: tests reviewer
- severity: medium
- observation: deleting the two `CREATE INDEX` lines kept every test green; only a throwaway EXPLAIN had shown them in use.
- fix: assert both index definitions exist in `pg_indexes`.

### A sort key from the URL could forge log lines
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/UnsupportedSortKeyException.java:14
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListTest.java:232
- source: security reviewer
- severity: low
- observation: the unsupported key went verbatim into the exception message, which is logged at warn; `sort=x%0AINFO …` wrote a fake log line.
- fix: replace control characters in the key before it enters the message.

### A non-numeric page or size in the URL reached the API as NaN
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:100
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:339
- source: tests reviewer
- severity: low
- observation: `/owners?page=abc` became `page=NaN` in the request to the server.
- fix: leave a non-numeric page or size to the server's default.

### The page-size test could not tell "keep position" from "reset to page 1"
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:205
- source: tests reviewer
- severity: low
- observation: page 3 at size 5 switching to 20 lands on page 1 either way, so a pager that always reset would pass.
- fix: switch from page 5 at size 5 to size 10, which must land on page 3.

### A pet type named like an Object member showed code instead of 🐾
- file: petclinic-frontend/src/app/pets/pet-type-emoji.ts:13
- source: /code-review xhigh
- severity: low
- observation: the lookup indexed a plain object literal; a type named `constructor` returned the Object function, and `??` did not fall back.
- fix: look the type up only among the map's own keys.

### The pager declared role="group" on a div
- file: petclinic-frontend/src/app/owners/owner-pager/owner-pager.component.html:1
- file: petclinic-frontend/src/app/owners/owner-pager/owner-pager.component.css:9
- source: CI (SonarCloud Web:S6819)
- severity: low
- observation: a `div` with `role="group"` instead of the element that carries the role natively.
- fix: a borderless `fieldset` with the same accessible name, "Pagination".

### The list's injected dependencies were not readonly
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:31
- source: CI (SonarCloud typescript:S2933)
- severity: low
- observation: the router, route and service are never reassigned but were not marked `readonly`.

### Validation messages duplicated as literals
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:36
- source: CI (SonarCloud java:S1192)
- severity: low
- observation: "Validation Error" and "Validation failed: {}" were each written three times.
- fix: one constant each.

## Ignored

### Address, Telephone and Pets are not sortable, though the ticket says any column
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:35
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:126
- source: ticket-fit reviewer
- severity: high
- observation: only Name and City sort; `sort=telephone` answers 400. The ticket asked for sorting by any column.
- why: decided with the human, QA.md:14; product owner must confirm, proposal.md:43

### The server accepts any size up to 20, not only 5, 10 or 20
- file: petclinic-backend/src/main/resources/application.properties:60
- source: ticket-fit reviewer, correctness reviewer
- severity: medium
- observation: `size=7` returns 7 rows, and the pager's size dropdown then shows no matching option.
- why: the spec only caps at 20, specs/owner-list/spec.md:29; design.md:126 (D6)

### Unrequested UI changes bundled with paging and sorting
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:6
- source: ticket-fit reviewer
- severity: medium
- observation: one-row search form, moved Add Owner, pet emojis and tooltips, pet links, Back behaviour.
- why: each one was asked for by the human while reviewing the running grid

### The page dropdown still lists every page
- file: petclinic-frontend/src/app/owners/owner-pager/owner-pager.component.ts:31
- source: tests reviewer, /code-review xhigh
- severity: medium
- observation: at 10,000 pages each pager renders 10,000 options, in two pagers.
- why: the human asked to pick any page; options are native, the O(n²) is fixed

### The tie-break test passes even without the id tie-breaker
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListTest.java:201
- source: tests reviewer
- severity: medium
- observation: two identical "John Smith" rows come back in insertion order, which is id order anyway.
- why: fresh inserts always come back in id order; forcing otherwise relies on MVCC internals

### Only the first sort parameter is applied
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:119
- source: correctness reviewer, ticket-fit reviewer, tests reviewer
- severity: low
- observation: `sort=city,asc&sort=name,desc` sorts by city only, without saying so.
- why: the contract offers single-key values only, OwnerRestController.java:100; every key is validated

### Deep pages run a large OFFSET and a count on every request
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:119
- source: security reviewer
- severity: low
- observation: `page=2000000000` makes each call skip rows and count the whole table.
- why: keyset paging is a non-goal, design.md:77; the last page measured 7 ms at 50k

### The last-name prefix search cannot use the ICU-collated index
- file: petclinic-backend/src/main/resources/db/migration/V4__owner_list_sorting.sql:4
- source: security reviewer, /code-review xhigh
- severity: low
- observation: Postgres cannot range-scan `LIKE 'Pot%'` on a non-C collation, so a search scans the table.
- why: accepted risk with its targeted fix named, design.md:152

### The default page size is not written into the URL
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:95
- source: ticket-fit reviewer
- severity: low
- observation: with no `size` in the URL the grid trusts the server's default of 10.
- why: the URL holds only what the user chose, design.md:130 (D7)

### Find Owner with an unchanged search does not refetch
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:57
- source: /code-review xhigh
- severity: low
- observation: the same URL is a no-op navigation, so clicking Find again shows no owners added since.
- why: rare; any page, sort or new text refetches

### Paging drops text typed but not searched; DESC in capitals shows ascending
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:76
- source: /code-review xhigh
- severity: low
- observation: each URL change rewrites the search box; `sort=city,DESC` sorts descending but lights the ascending arrow.
- why: the URL is the only state, design.md:130; the grid never writes DESC

### A tooltip can stay after its element disappears under the pointer
- file: petclinic-frontend/src/app/design-system/tooltip.ts:55
- source: /code-review xhigh
- severity: low
- observation: removed without a mouseout, the bubble stays until scroll, Escape or another hover.
- why: needs navigating away without moving the mouse; it then clears itself

## Assumptions

### ICU root collation puts Łódź before Lyon, against a spec scenario
- file: petclinic-backend/src/main/resources/db/migration/V4__owner_list_sorting.sql:4
- file: openspec/changes/owners-grid-pagination/specs/owner-list/spec.md:82
- alternative: `pl-x-icu`, which puts Łódź after Lyon but is Polish-only
- confidence: 0.6
- why: D4 chose a language-neutral collation for owners of many nationalities, and its root rules weigh Ł as L. The scenario looks written by hand, not measured, but nobody has confirmed which side should give.

### Every sort key is validated, but only the first is applied
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:119
- alternative: answer 400 when more than one sort key is sent
- confidence: 0.7
- why: the spec rejects unknown keys and is silent on several; the grid only ever sends one.

### The page dropdown offers every page, not a window around the current one
- file: petclinic-frontend/src/app/owners/owner-pager/owner-pager.component.ts:31
- alternative: first, last and the pages near the current one
- confidence: 0.55
- why: the human asked to select any page from the range text. At 10,000 pages a full list is hard to scroll, which pulls this down.

### Tooltips as one data-tip component of our own, not Material's matTooltip
- file: petclinic-frontend/src/app/design-system/tooltip.ts:31
- alternative: `matTooltip` from Angular Material, already a dependency
- confidence: 0.6
- why: the project's tooltips rule asks for one declarative attribute with a large, quick bubble. Material would have been less code to own.

### Back tells in-app history from a direct open by the router's navigationId
- file: petclinic-frontend/src/app/pets/pet-edit/pet-edit.component.ts:73
- file: petclinic-frontend/src/app/owners/owner-detail/owner-detail.component.ts:33
- alternative: a service that counts NavigationEnd events
- confidence: 0.65
- why: it reads an undocumented field the Router writes into history.state, now in two places; it works today and is cheap.

### A pet's name links to its edit page
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:55
- alternative: a read-only pet page, which the app does not have
- confidence: 0.85
- why: the human asked for the pet's details, and the edit page is the only page that shows them.

### "print" in the dictation meant the plus icon on Add Owner
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:12
- alternative: a printer glyphicon on Add Owner
- confidence: 0.8
- why: a plus is what an add button carries; the human saw it and did not object.

### The native titles on the menu links were removed, not converted
- file: petclinic-frontend/src/app/app.component.html:17
- alternative: keep them as `data-tip` tooltips
- confidence: 0.8
- why: each repeated the link's own text, so a tooltip added nothing.

### Pages in the URL count from 1, the API's from 0
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:116
- source: human
- alternative: the same 0-based page in the URL as in the API
- confidence: 1.0
- why: the human asked for it, because people read and share the URL.
