---
base: 2ed7c8fb2f1ae7a51e5177cee9ff5747ddd1968e
audited-base: 2ed7c8fb2f1ae7a51e5177cee9ff5747ddd1968e
audited-head: 1cab893dee5bf64cf611a90d3fa199ea9b2c2b11
implementation: 1cab893dee5bf64cf611a90d3fa199ea9b2c2b11
head: 1cab893dee5bf64cf611a90d3fa199ea9b2c2b11
reviewers: /code-review xhigh (Claude Code built-in, run in this conversation over the same change before prepare) + pre-push hook
harness: claude-code
session: f6c3f10c-d93d-4f00-ae80-b1113022061c
fixed-in: HEAD
anchors: review-commit
ticket: victorrentea/petclinic#25
---

## Fixed

### A failed page request froze the grid for good
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:42-56
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:21-25
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:213-226
- source: /code-review xhigh
- severity: high
- observation: HttpErrorHandler re-throws, so one 500 errored the only queryParamMap subscription; every later sort, page or search changed the URL and fetched nothing.
- fix: catch per request inside switchMap and show a "could not be loaded" message instead.

### Name and city order depended on the server's locale
- file: petclinic-backend/src/main/resources/db/migration/V4__owner_grid_indexes.sql:1-6
- file: openspec/changes/paginate-owners-grid/design.md:118-121
- file: openspec/changes/paginate-owners-grid/tasks.md:13
- source: /code-review xhigh
- severity: high
- observation: nothing pinned the collation; a CI runner under C.UTF-8 sorts Śliwiński after Tremaine, failing the sort tests and the grid's order.
- fix: V4 sets the ICU en-x-icu collation on last_name, first_name and city.

### A page past the end showed "No owners yet" with no paginator
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:46-56
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:228-236
- source: /code-review xhigh
- severity: medium
- observation: a bookmarked or refreshed ?page=5 got an empty page with totalElements > 0; the template keyed on rows, said the clinic is empty and hid the way back.
- fix: a page past the end redirects to the last page.

### The record's Back button dropped the grid's page, sort and search
- file: petclinic-frontend/src/app/owners/owner-detail/owner-detail.component.ts:28
- file: petclinic-frontend/src/app/owners/owner.service.ts:15-16
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:39
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:238-244
- file: petclinic-frontend/src/app/owners/owner-detail/owner-detail.component.spec.ts:18
- source: /code-review xhigh
- severity: medium
- observation: Back navigated to a bare /owners, contradicting the spec's "Back from an owner's record" scenario; only the browser's Back kept the place.
- fix: the grid leaves its URL params on OwnerService; Back navigates with them.

### The name pipe rendered "undefined, undefined" while loading
- file: petclinic-frontend/src/app/shared/owner-name.pipe.ts:6-8
- file: petclinic-frontend/src/app/shared/owner-name.pipe.spec.ts:10-17
- file: petclinic-test/src/support/api-client.ts:30
- source: /code-review xhigh
- severity: medium
- observation: every form starts from `{} as Owner` and a pet may have no owner, so the pipe printed undefined or null where the old template printed nothing.
- fix: join only the parts that exist.

### A glue step line over 119 characters blocked the push
- file: petclinic-test/src/owners-grid.feature.glue.ts:30-35
- source: pre-push hook
- severity: low
- observation: the pre-push line-length check refused the implementation commit.
- fix: wrapped the step definition.

## Ignored

### e2e steps can read the previous page's rows
- file: petclinic-test/src/owners-grid.feature.glue.ts:14-18
- source: /code-review xhigh
- severity: medium
- observation: andLoad resolves on the response, before Angular renders; a one-shot inOrder assertion may read stale rows.
- why: not fixed yet; green on four runs; belongs with an OwnersPage page object.

### Missing Gherkin scenarios for pets toggle, no-match message, Back
- file: petclinic-test/src/owners-grid.feature:10
- source: /code-review xhigh
- severity: medium
- observation: three new user-facing requirements are covered only by Karma specs, which AGENTS.md says do not count.
- why: not done yet; follow-up before the change is archived.

### Non-numeric or overflowing page returns 500, not 400
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:132
- source: /code-review xhigh
- severity: medium
- observation: page=abc hits the catch-all 500 handler; page=200000000 overflows Spring Data's offset.
- why: type mismatch is a 500 on every endpoint today; needs its own handler.

### Typed but unsubmitted search text is erased by a sort click
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:38
- source: /code-review xhigh
- severity: low
- observation: the tap writes the URL's lastName back into the box; Find with an unchanged query no longer reloads.
- why: minor UX edge; the URL is the single source of truth by D10.

### openapi.yaml documents size as a 5–20 range, not {5, 10, 20}
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:113
- source: /code-review xhigh
- severity: low
- observation: a contract client may send size=15 and get a 400.
- why: springdoc enums are strings; an enum would type size as "5" | "10" | "20".

### The ▾ toggle can go stale when the web font arrives late
- file: petclinic-frontend/src/app/owners/owner-list/overflow.directive.ts:8
- source: /code-review xhigh
- severity: low
- observation: ResizeObserver fires on box changes; a wider font in a fixed-width cell changes no box.
- why: cosmetic and rare; the font is usually cached after the first page.

### Statement-count test boots its own Spring context
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerGridQueryCountTest.java:20
- source: /code-review xhigh
- severity: low
- observation: the properties attribute forks a context and an embedded Postgres; statistics could be enabled at runtime.
- why: a few seconds per build; kept explicit and isolated for now.

### AddVisitApiTest looks for a pet on the first page only
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/AddVisitApiTest.java:106
- source: /code-review xhigh
- severity: low
- observation: committed petless owners sorting before Baskerville could push every pet owner off page 1.
- why: the test DB is seeded per run; no committing test adds petless owners.

### playwright-test MCP server removed from .mcp.json
- file: .mcp.json:19
- source: /code-review xhigh
- severity: info
- observation: the removal breaks the Playwright Test agents and leaves petclinic-test/AGENTS.md stale.
- why: not part of this change; someone else's edit, left out of these commits.

### Screenshot and diagrams the change depends on were untracked
- file: user-manual/manual.md:55
- source: /code-review xhigh
- severity: info
- observation: owners-sort-page.png and the renamed genseq diagrams showed as untracked.
- why: refuted — all are committed in the implementation commit.

## Assumptions

### Pet.visits batch of 100, not the 20 the design proposed
- file: petclinic-backend/src/main/java/victor/training/petclinic/domain/Pet.java:54
- alternative: @BatchSize(20) on both collections, as design D6 first said
- confidence: 0.8
- why: a page of 20 owners holds more than 20 pets, and 20 split the visits load in two. Postgres binds the batch as one array, so 100 costs nothing; pulled down only because nobody asked for the number.

### Descending city also flips the name tie-break
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerSortKey.java:23
- alternative: city descending, then names still A to Z
- confidence: 0.55
- why: one Sort direction over every key keeps the index scannable backwards. The spec only says "by last name, then first name" for ties, so a reviewer may well expect A to Z within a city.

### Grid changes replace the history entry instead of pushing one
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:103
- alternative: push a history entry per page, so Back steps through pages
- confidence: 0.6
- why: you asked for refresh and links to keep the page, not for Back to walk pages. replaceUrl keeps Back meaning "leave the screen"; a staff member paging through 50k owners may disagree.

### Unreadable grid values in the URL fall back to defaults
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:123-127
- alternative: forward them and show the API's 400
- confidence: 0.75
- why: a hand-edited or stale link should still open a usable screen; the API keeps rejecting such values for other clients.

### English ICU collation for names and cities
- file: petclinic-backend/src/main/resources/db/migration/V4__owner_grid_indexes.sql:3-6
- alternative: und-x-icu (root), or a Romanian/Polish locale
- confidence: 0.7
- why: English puts Ś among the S's as the spec asks, and ships in every Postgres build with ICU. A Romanian clinic might expect Ș and Ț to sort after S and T.

### ▾ shown when the names are cut off, not by pet count
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:63
- alternative: show it from three pets on
- confidence: 0.7
- why: you asked for the ellipsis "if there are too many"; measuring the cut matches what the eye sees at any width, at the cost of a small directive.

### Paginator font and sort arrows restyled for this grid only
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.css:85
- alternative: set Material's typography and arrow style once in styles.css
- confidence: 0.6
- why: you asked about this screen, and a global theme change would also restyle the vet and pet forms' dropdowns. The next Material table will have to repeat it.

### Ten rows per page by default
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:11
- alternative: five, the smallest size the ticket lists
- confidence: 0.85
- why: ten fills a laptop screen without scrolling at 1280px; the ticket lists the sizes, not the default.
