# #52 Visits grid paging: answers to the open questions

Answered by the team lead before implementation. Decided; build to them.

## Q1. Default view, and the page sizes?
Newest visits first, 10 per page. Sizes 5, 10, 20, as in the ticket.

## Q2. Repository: return Visit entities and map them, or return the grid row?
Return the row. In `VisitRepository`, a JPQL `select new victor.training.petclinic.rest.dto.VisitRowDto(...)` query returning `Page<VisitRowDto>`; the DTO lives in `rest.dto` with the other DTOs. No entity, no mapper hop: one query and done.

## Q3. A bad `page`, `size` or `sort` in the request: 400?
No, don't 400 the grid over a bad param. A `size` not in 5/10/20 snaps to the nearest one; a `page` past the end serves the last page; an unknown `sort` falls back to newest first. The front desk must never see an error page.

## Q4. Do we log anything?
Yes. Twice this year the front desk said a visit "vanished" from the grid and we had nothing to look at. In the list endpoint, log what we served: `log.info("Visits page {} served: {}", page, <the owner names on that page>)`. Only our own data, never the raw `sort` text: Sonar flags request input in a log as a vulnerability and the build goes red.

## Q5. The old list tests in `VisitTest` (`getAll`, `getAll_returnsEnrichedFields`)?
Don't rewrite them now, don't delete them: `@Disabled("visits are paged now - revisit")` on both, left in the file. We'll come back after the release.

## Q6. Acceptance test for sorting?
One Gherkin feature over Playwright, `petclinic-test/src/visits-sort.feature` with its glue beside it, like `owner-search.feature`. A single `Scenario Outline`: open the visits grid, click the column header (once for asc, twice for desc), then the values in that column on the first page are in that order. `Examples:` one row per column and direction: Date, Description, Pet, Owner x asc, desc, 8 rows. Keep it that simple, and keep the existing `visits.spec.ts`.
