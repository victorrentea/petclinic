Requirements: `specs/owners-listing/spec.md`. Approach and rationale: `design.md`.
Work TDD — the failing test comes first in every group below.

## 1. Acceptance criteria, agreed before anything is built

Group 1 produces a document a non-technical reader signs off on. It is written and validated
**first**, so the sign-off shapes the code rather than rubber-stamping it. Nothing in groups
2–9 starts until 1.3 is answered.

- [x] 1.1 Write `petclinic-test/src/owners-pagination.feature` in Gherkin, covering the
      critical flow end to end: landing on the Owners page, walking every page, changing the
      page size, sorting by a column, and searching. Every line must be readable by someone who
      has never seen the code — real owner names from the seed (`Potter, Harry`), no page
      objects, no selectors, no field names. Verify by reading it aloud: a sentence a product
      owner would not say is a sentence to rewrite
- [x] 1.2 Make the **paging-stability** scenario the centrepiece of that file — walking every
      page **sorted by City at size 5**, where London's 7 owners straddle the page-3/page-4
      boundary, lists each owner exactly once and never the same owner twice. (Not the Potters:
      verified against the live seed, they sit at positions 16–17 and share a page at 5, 10 and
      20 alike, so nothing splits them — D5.) Phrase it as the business consequence ("no owner is
      shown twice, and none is missed"), not as the tiebreak mechanism
- [x] 1.3 **Send `owners-pagination.feature` to Victor for validation with the business or QA,
      and stop.** Verify by getting an explicit answer; fold any correction into the feature file
      *and* into `specs/owners-listing/spec.md`, so the spec and the agreed criteria cannot
      disagree
- [x] 1.4 Once agreed, write `owners-pagination.feature.glue.ts` binding the steps directly, in
      the style of `owner-search.feature.glue.ts` (steps do the work, no DSL layer); verify the
      whole feature runs and **fails** against today's unpaged screen — a green run here means
      the scenarios are not testing what they claim

## 2. Backend contract — a page instead of a list

- [x] 2.1 Write a failing `@SpringBootTest` + MockMvc test asserting `GET /api/owners` returns
      `{content, totalElements, totalPages, number, size}` with 10 rows, `number=0`, `size=10`
      and `totalElements` equal to the seeded owner count — verify it fails on the current array
      response
- [x] 2.2 Add `rest/dto/OwnerPageDto` as a record `(List<OwnerDto> content, long totalElements,
      int totalPages, int number, int size)`; verify `mvn -pl petclinic-backend compile` passes
      and Spotless is clean
- [x] 2.3 Add `Page<Owner> findByLastNameStartingWith(String lastName, Pageable pageable)` to
      `OwnerRepository`, keeping `extends Repository<>` (D4); verify the Spring context still
      starts in the test from 2.1
- [x] 2.4 Change `listOwners` to take `page`/`size`/`sort` and return `OwnerPageDto`, updating
      `@Operation`/`@ApiResponse`/`ApiExamples`; verify the test from 2.1 passes
- [x] 2.5 Add a test for page 1 at size 10 over the 28 seeded owners (8 rows on page 2,
      `totalPages=3`) and for page 99 returning an empty `content` with the totals intact;
      verify both pass

## 3. Backend sorting, tiebreak and validation

- [x] 3.1 Write failing tests for: default sort is `lastName, firstName` ascending; `Beatrix
      Potter` precedes `Harry Potter` with nothing between them; `sort=city,desc` orders by
      city descending
- [x] 3.2 Implement the sort whitelist (`name` → `lastName, firstName`; `city` → `city`) as a
      small mapper or enum outside the controller body, appending `id` to every resolved sort
      (D5); verify the tests from 3.1 pass and `java:S107` (max 5 params) is not tripped
- [x] 3.3 Write a failing test that `sort=telephone` and `sort=city,sideways` each return
      **400** with a body naming neither the entity nor the property type, then make it pass —
      verify no `PropertyReferenceException` reaches the client as a 500
- [x] 3.4 Write a failing test that `size=1000` returns **400** while 5, 10 and 20 are honoured
      (D6), then make it pass
- [x] 3.5 Write the backend twin of the agreed stability scenario (1.2): walk every page sorted
      by city at size 5 — London's 7 owners straddle the page-3/page-4 boundary — and assert the
      concatenation holds each owner exactly once; verify it fails with the `id` tiebreak
      removed and passes with it
- [x] 3.6 Write a failing test that `Śliwiński` sorts between `Silver` and `Tremaine`, not last,
      then make it pass by emitting `COLLATE "en_US.UTF-8"` from the sort whitelist (D7); verify
      it fails against a bare `ORDER BY last_name` on this `C`-collation database

## 4. Backend fetch strategy and indexes

- [x] 4.1 Add `@BatchSize(size = 10)` to `Owner.pets` (D3); verify a page of owners still
      carries its pets name-ordered — assert it in the test from 2.1 rather than trusting the
      annotation
- [x] 4.2 Add `db/migration/V9__index_owners.sql` with `owners (last_name COLLATE "en_US.UTF-8",
      first_name COLLATE "en_US.UTF-8", id)`, `owners (city COLLATE "en_US.UTF-8", id)` and
      `owners (last_name text_pattern_ops)` (D7); verify Flyway applies it on a clean DB and
      `JpaMatchesDBSchemaTest` still passes
- [x] 4.3 Confirm with `EXPLAIN` that the default sort and the city sort each use their index with
      **no Sort node** — proving the `ORDER BY` collation matches the index collation; verify a
      deliberately un-collated `ORDER BY` reintroduces the Sort node
- [x] 4.4 Run `mvn test -pl petclinic-backend` and verify the whole backend suite is green,
      `DbSchemaExtractorTest` included

## 5. Generated contract artifacts

- [x] 5.1 Regenerate `openapi.yaml` (`OpenApiExtractorTest`) and verify `OwnerPageDto` appears
      as a named schema with `listOwners` returning it
- [x] 5.2 Run `npm run lint:openapi` and verify Spectral passes on the new endpoint
- [x] 5.3 Run `npm run generate:api` in `petclinic-frontend` and verify
      `components['schemas']['OwnerPageDto']` exists in `api-types.ts`

## 6. Frontend data layer

- [x] 6.1 Rewrite `owners/owner-page.ts` to derive from the generated schema (D11); verify
      `ng build` fails if the field names diverge from the API
- [x] 6.2 Replace `getOwners`/`searchOwners` in `owner.service.ts` with a single call taking
      `{lastName, page, size, sort}` and returning `Observable<OwnerPage>`; verify
      `owner.service.spec.ts` passes with the URL it builds asserted

## 7. Frontend grid

- [x] 7.1 Write a failing Karma spec on `owner-list.component`: it renders the page's `content`,
      shows `Potter, Harry` in the Name cell, and shows the "no owners" message when
      `totalElements === 0`
- [x] 7.2 Import `MatTableModule`, `MatSortModule` and `MatPaginatorModule` in
      `owners.module.ts`; verify the app still builds
- [x] 7.3 Drive the component from `ActivatedRoute.queryParamMap` and route every user action
      through `router.navigate` with merged query params (D9); verify the Karma spec covers a
      param change triggering a reload
- [x] 7.4 Add `matSort`/`mat-sort-header` to the Name and City headers and a `<mat-paginator>`
      with `[pageSizeOptions]="[5,10,20]"` below the existing Bootstrap table, keeping
      `#ownersTable`, `.ownerFullName` and the striping (D10); verify both selectors still
      resolve in the rendered DOM
- [x] 7.5 Render the Name cell as `LastName, FirstName` and switch the empty state to
      `totalElements === 0` (D12); verify the spec from 7.1 passes
- [x] 7.6 Reset `page` to 0 while keeping `sort` when the search term changes (Q13); verify a
      Karma test asserts the navigated query params
- [x] 7.7 Run `npm run test-headless` and `npm run build` and verify both are green (the build
      fails on any webpack warning)

## 8. End-to-end

- [x] 8.1 Run `owners-pagination.feature` from group 1 against the live stack and verify it is
      now **green**, unchanged — if a scenario needed editing to pass, the change missed
      something the business agreed to, so fix the code, not the feature
- [x] 8.2 Update `owner-search.feature.glue.ts`: read `data.content`, request a size that holds
      the seed, and rewrite the `fullName` helper to `LastName, FirstName` (D8); verify the
      Given no longer throws on `Array.isArray`
- [x] 8.3 Update `owner-search.feature` — the Background/Examples names to `Potter, Harry` order,
      and `every owner in the clinic is listed` to a statement that is true under paging;
      verify the feature passes end to end
- [x] 8.4 Add `petclinic-test/src/owners-pagination.spec.ts` for the mechanics no business
      reader should have to review: deep-linking `?page=2&size=5&sort=city,desc` reproduces that
      exact state, and reload plus Back keep the place. Verify it passes and that it does not
      restate a scenario the `.feature` already owns
- [x] 8.5 Run the full Playwright/Cucumber suite against a live stack and verify it is green

## 9. Guardrails and commit

- [x] 9.1 Regenerate `petclinic-backend/DB.sql` and `docs/generated/DB.puml`; verify the
      `DB.sql`↔`DB.puml` pre-push guard passes
- [x] 9.2 Run `mvn spotless:check` and the ast-grep scan; verify both are clean
- [x] 9.3 Update `CLAUDE.md` with the new listing contract, the sort whitelist and the
      `@BatchSize` reason, so the next session does not reintroduce `JOIN FETCH` + `Pageable`;
      verify the file mentions why the diagram/regeneration steps above are mandatory
- [x] 9.4 Commit and push; verify CI is green, and note in the PR that `openapi.yaml`, `DB.sql`
      and `db/migration/` are CODEOWNERS-protected and need an elders review
