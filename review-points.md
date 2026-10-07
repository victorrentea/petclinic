---
base: 390f0e0efee30a2aeeaa07895560d97eafaab479
audited-base: 390f0e0efee30a2aeeaa07895560d97eafaab479
audited-head: 5190fd3cd9e23d8a1107cf15baa6ca87937b27e9
implementation: 0b99e29cd8bb8f6895c4af13c1c20ac361546a60
head: 5190fd3cd9e23d8a1107cf15baa6ca87937b27e9
reviewers: /code-review xhigh (user-launched, background) + /simplify 4 lenses (reuse, simplification, efficiency, altitude) + CI/SonarCloud
harness: claude-code
session: 8782fda6-f385-4d47-8079-96d9f3c08509
fixed-in: HEAD
anchors: review-commit
---

## Fixed

### Add Owner vanished when a search matched nobody
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:16
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:163
- source: /code-review xhigh
- severity: medium
- observation: the button moved inside #ownersTable, rendered only when totalElements > 0; on no match, an error or an empty clinic there was no way to /owners/add.
- fix: the empty and error states show their own Add Owner under the message.

### Bad page input answered 500 instead of 400
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:73
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:61
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:103
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListTest.java:124
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListTest.java:131
- source: /code-review xhigh
- severity: medium
- observation: ?page=abc hit the catch-all handler as a type mismatch; ?page=30000000&size=100 overflowed Spring Data's int offset. Both logged at ERROR as 500.
- fix: type mismatches map to 400 for every endpoint; page is capped at Integer.MAX_VALUE / MAX_PAGE_SIZE.

### Find Owner with an unchanged name did not search again
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:60
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:32
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:171
- source: /code-review xhigh
- severity: low
- observation: search() only navigates; an identical URL emits nothing, so a repeated search showed stale results where the old grid re-fetched.
- fix: an unchanged query is pushed through a reload subject merged into the URL stream.

### Hibernate statistics left switched on for the cached context
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListTest.java:224
- source: /code-review xhigh
- severity: low
- observation: the batch-fetch test enabled statistics on the shared SessionFactory and never disabled them, so later tests reusing the context paid for and inherited them.
- fix: try/finally switches them off.

### Visit-date scenario still read the owner list as an array
- file: petclinic-test/src/visit-date-range.feature.glue.ts:20
- source: /code-review xhigh
- severity: high
- observation: `owners.reduce is not a function` failed both visit-date-range scenarios in their Background once the list became a page.
- fix: the scenario creates its own owner and puts the pet on it.

### AddVisitApiTest sequence diagram showed the old list call
- file: petclinic-test/generated/AddVisitApiTest.java.adds-a-visit-to-an-existing-pet.genseq.puml:16
- source: /code-review xhigh
- severity: low
- observation: the committed diagram still drew "List owners" with an array payload; only the browser suites' diagrams had been re-traced.
- fix: re-traced with petclinic-backend/run-tests-with-tracing.sh.

### Validation responses built from the same literals four times
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:79
- source: CI (SonarCloud java:S1192)
- severity: low
- observation: "Validation failed: {}", "Validation Error" and "errors" were duplicated across the 400 handlers; the new type-mismatch handler made it a fourth copy.
- fix: one badRequest helper builds every validation 400.

### Dead stylesheet rules from an earlier pager layout
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.css:2
- source: /simplify simplification
- severity: low
- observation: about 80 lines (#nameGroup, .owners-pagination, .owner-search-label, …) matched nothing in the template, beside the live rules.
- fix: deleted; the two #ownersTable table rules merged into one.

### Label rules only undid form-horizontal
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:5
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.css:11
- source: /simplify simplification
- severity: low
- observation: the form kept form-horizontal only for its control-label styling, which the search-row rules then reset property by property.
- fix: dropped the class; only margin and nowrap remain.

### Sort arrows overrode Material's private DOM with !important
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:23
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:72
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.css:65
- source: /simplify altitude
- severity: medium
- observation: ::ng-deep rules hid .mat-sort-header-arrow's children and cancelled its animation styles; a Material upgrade breaks them silently.
- fix: the headers draw ▲/▼ from the component's own sort state; MatSort is gone, along with the dead `|| 'asc'`.

### Column widths tied to column order
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.css:24
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:26
- source: /simplify altitude
- severity: low
- observation: th:nth-child(1..5) widths go wrong silently when a column is added or moved.
- fix: one class per column.

### Shell padding zeroed to undo its own container-fluid
- file: petclinic-frontend/src/app/app.component.html:1
- file: petclinic-frontend/src/app/app.component.css:9
- source: /simplify altitude
- severity: low
- observation: .main-wrapper padding was set to 0 to cancel the gutter of the container-fluid class on the same div.
- fix: removed the class instead.

### Query types written by hand beside the generated one
- file: petclinic-frontend/src/app/owners/owner.service.ts:11
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:10
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts:44
- source: /simplify reuse
- severity: medium
- observation: OwnerQuery and OwnerListQuery restated listOwners' parameters, so a backend parameter change would not break the frontend build.
- fix: OwnerQuery comes from api-types.ts; the component uses Required<OwnerQuery>.

### Error fallback that is never returned
- file: petclinic-frontend/src/app/owners/owner.service.ts:36
- source: /simplify simplification
- severity: low
- observation: handlerError always rethrows, so `{} as OwnerPage` suggested failures became an empty page.
- fix: only the type argument is kept.

### Batch fetching added one association at a time
- file: petclinic-backend/src/main/resources/application.properties:15
- file: petclinic-backend/src/main/java/victor/training/petclinic/domain/Owner.java:56
- file: petclinic-backend/src/main/java/victor/training/petclinic/domain/Pet.java:51
- source: /simplify altitude
- severity: medium
- observation: @BatchSize fixed the N+1 only on the two collections the grid walks; Vet.specialties kept its own.
- fix: hibernate.default_batch_fetch_size=100 replaces both annotations.

### Page-to-DTO conversion inlined in the controller
- file: petclinic-backend/src/main/java/victor/training/petclinic/mapper/OwnerMapper.java:32
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:109
- source: /simplify reuse
- severity: low
- observation: every other entity↔DTO conversion lives in a mapper; this one was five accessor calls in listOwners.
- fix: OwnerMapper.toOwnerPageDto.

### Private route stub duplicating ActivatedRouteStub
- file: petclinic-frontend/src/app/testing/router-stubs.ts:56
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:36
- source: /simplify reuse
- severity: low
- observation: the spec carried its own BehaviorSubject stub beside the shared one 15 specs use.
- fix: the shared stub gained queryParamMap and setQueryParams.

### Add-visit glue walked owner pages to find a pet
- file: petclinic-test/src/add-visit.dsl.ts:17
- file: petclinic-test/src/support/api-client.ts:48
- source: /simplify efficiency
- severity: low
- observation: the loop paged through owners because leftover pet-less "Ada Acceptance" owners sort first, one more round trip per hundred leftovers.
- fix: one GET of seed owner 1, through ApiClient.

### Owner-search glue repeated steps, locators and calls
- file: petclinic-test/src/owner-search.feature.glue.ts:77
- file: petclinic-test/src/owner-search.feature.glue.ts:19
- file: petclinic-test/src/owner-search.feature.glue.ts:45
- file: petclinic-test/src/support/api-client.ts:43
- source: /simplify simplification
- severity: low
- observation: two steps differed by one word, the cell locator and poll lived in three places, and the Background asked for the Potters twice, sequentially, on localhost.
- fix: one {word} step, a listedNames helper, deduped lookups in Promise.all through ApiClient.

### New owner-creation line over the 119-character limit
- file: petclinic-test/src/visit-date-range.feature.glue.ts:20
- source: pre-push hook
- severity: low
- observation: scripts/check-line-length.py blocked the push on a 122-character axios.post line.
- fix: the request body is wrapped one field group per line.

### Dropped @ResponseStatus erased the 400 from the API contract
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:50
- source: pre-push hook
- severity: medium
- observation: the badRequest extraction removed @ResponseStatus(BAD_REQUEST); springdoc then dropped the 400 response from every operation in openapi.yaml.
- fix: restored on the two validation handlers; openapi.yaml back to its committed state.

## Ignored

### ListGetFirstTest input snippet has unbalanced braces
- file: refactoring-tools/src/test/java/victor/training/petclinic/rewrite/ListGetFirstTest.java:49
- source: /code-review xhigh
- severity: medium
- observation: 5190fd3c deleted the `firstPet` method line from the rewrite input, so the test's Java no longer parses.
- why: the human's own live-coding edit, committed as found at their request.

### Accented names sort after Z under a C collation
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListTest.java:168
- source: /code-review xhigh, CI
- severity: medium
- observation: zonky inherits the runner's locale; under C.UTF-8 'Łukasz' sorts after 'Mister' and accentedNames_sortAlphabetically fails CI.
- why: the human chose to leave CI red on this for now.

### Booking does not check the pet belongs to the owner
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:213
- source: /code-review xhigh
- severity: high
- observation: POST /api/owners/1/pets/{another owner's pet}/visits books it and texts owner 1; the MCP path checks ownership.
- why: predates the audited range (visit-date commit b23c6d3a); worth its own ticket.

### Visit-date rule skipped by the MCP tool and birth-date edits
- file: petclinic-backend/src/main/java/victor/training/petclinic/mcp/PetClinicMcp.java:69
- source: /code-review xhigh
- severity: medium
- observation: create_visit only requires a future date, and moving a pet's birthDate past its visits is never checked.
- why: the visit-date rule is b23c6d3a's, outside this change set.

### An undated visit skips the visit-date rule
- file: petclinic-backend/src/main/java/victor/training/petclinic/domain/Pet.java:90
- source: /code-review xhigh
- severity: medium
- observation: requireValidVisitDate returns on a null date, and VisitMapper overwrites the entity's default with null.
- why: the visit-date rule is b23c6d3a's, outside this change set.

### Domain rule handled as the broad ValidationException
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/error/ExceptionControllerAdvice.java:59
- source: /code-review xhigh
- severity: low
- observation: Hibernate Validator's own failures (HV000030) now answer 400 at WARN instead of 500 at ERROR.
- why: the handler came with b23c6d3a, outside this change set.

### Visit form and server read "today" from different clocks
- file: petclinic-frontend/src/app/visits/visit-add/visit-add.component.ts:26
- source: /code-review xhigh
- severity: low
- observation: the form's max date uses the browser's timezone, the server's LocalDate.now() the JVM's; they disagree near midnight.
- why: b23c6d3a's visit form, outside this change set.

### Visit booking saves the stub Pet, not the loaded one
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/VisitRestController.java:76
- source: /code-review xhigh
- severity: low
- observation: bookVisit loads the Pet only to validate it, then saves the Visit with the mapper's id-only stub.
- why: b23c6d3a's booking path, outside this change set.

### Descending sorts mix directions the indexes cannot walk
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:118
- source: /code-review xhigh
- severity: info
- observation: city DESC with names ASC needs an incremental sort over each city's group.
- why: measured at 0.27 ms on 100k rows, openspec/changes/paginate-owners-grid/design.md:134

### List payload still carries every pet's visits
- file: petclinic-backend/src/main/java/victor/training/petclinic/mapper/PetMapper.java:28
- source: /simplify efficiency, /simplify altitude
- severity: low
- observation: the grid shows pet names, yet each page loads and serializes all visits — one extra batch query and payload.
- why: a slim row is a contract change, a non-goal: openspec/changes/paginate-owners-grid/design.md:72

### Count query repeated on every page turn
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:107
- source: /simplify efficiency
- severity: low
- observation: Page re-runs count(*) on each click although the total did not change.
- why: accepted at 10 ms for 100k rows: openspec/changes/paginate-owners-grid/design.md:146

### Last page is a 100k-row offset
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:50
- source: /simplify efficiency
- severity: low
- observation: showFirstLastButtons jumps to OFFSET 99990, which walks the whole index.
- why: keyset paging is a non-goal, 24 ms measured: openspec/changes/paginate-owners-grid/design.md:71

### Hand-rolled paging params instead of Spring's Pageable
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:105
- source: /simplify reuse
- severity: info
- observation: Pageable, @PageableDefault and max-page-size exist for this.
- why: rejected for the sort whitelist and 400-not-clamp: openspec/changes/paginate-owners-grid/design.md:88

### Overlapping OwnerListTest cases could be merged
- file: petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerListTest.java:138
- source: /simplify simplification
- severity: info
- observation: the default-page test already proves first-name order, so the Beatrix/Harry test adds nothing.
- why: each test pins one spec scenario: openspec/changes/paginate-owners-grid/specs/owner-list/spec.md:50

### Shared aPage fixture builder for the specs
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts:46
- source: /simplify reuse
- severity: info
- observation: two specs each build their own OwnerPage fixture.
- why: two uses; the reviewer itself said not worth it until a third.

## Assumptions

### Tie-breakers stay ascending whichever way the column sorts
- file: petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java:118
- alternative: tie-breakers follow the clicked direction, one backward index walk
- confidence: 0.6
- why: the spec says owners within a city are ordered by name, read as A→Z (openspec/changes/paginate-owners-grid/specs/owner-list/spec.md:56). Nobody asked how a descending city should order its own names; a reviewer reading "descending" as the whole row reversed would be equally right.

### Seed owner 1 is the add-visit scenario's owner with a pet
- file: petclinic-test/src/add-visit.dsl.ts:17
- alternative: take the first pet from GET /api/pets
- confidence: 0.75
- why: AGENTS.md promises owner 1 = Kevin McCallister to tests, and the DSL fails loudly if he loses his pet. It now books on Kevin every run rather than on whichever owner listed first.

### The visit-date scenario leaves its own owner behind
- file: petclinic-test/src/visit-date-range.feature.glue.ts:20
- alternative: delete the owner in the After hook with the pet
- confidence: 0.65
- why: matches add-owner.spec.ts, which leaves its owners on purpose; the After hook already deletes the pet. Pulls down: each run adds one more pet-less owner to the dev database.

### Add Owner appears twice in the template, not once outside the table
- file: petclinic-frontend/src/app/owners/owner-list/owner-list.component.html:16
- alternative: one footer row outside #ownersTable, paginator shown conditionally inside it
- confidence: 0.7
- why: the acceptance tests select `#ownersTable mat-paginator`, so the paginator must stay inside the table block; a second button in the empty state keeps that.
