# Owner Pagination and Sorting Q&A

This decision record refines [GitHub issue #25](https://github.com/victorrentea/petclinic/issues/25)
for a projected dataset of 100,000 owners.

## 1. Where do pagination, sorting, and filtering run?

Server-side. Fetching 100,000 owners and their nested pets and visits into the browser is not viable.

## 2. Who consumes the backend REST API?

The metadata embedded in `petclinic-backend/docs/Deployment.drawio.png` identifies the Angular
Frontend (`traceParticipant="Browser"`) as the only deployed inbound REST consumer. Pet Owner and
Veterinarian are indirect users through the Frontend.

The Backend calls Notification Service, so Notification Service is not a consumer of the Backend
API. PostgreSQL is accessed through JPA/SQL. Tests are intentionally excluded from the deployment
model.

## 3. Should the existing endpoint change or should we add another endpoint?

Replace `GET /api/owners` in place. All documented deployed consumers are controlled in this
repository, and retaining an unbounded endpoint would leave an operational hazard.

## 4. What is the response contract?

Return an explicit `OwnerPageDto`, rather than serializing Spring Data's `Page` directly. It has:

- `content`
- `number`
- `size`
- `totalElements`
- `totalPages`

This keeps the public JSON stable across Spring versions.

## 5. What does each grid row contain?

Use a lightweight `OwnerRowDto` containing owner ID, first name, last name, address, city,
telephone, and pet names. Keep `OwnerDto` for owner detail. The grid must not load visits.

## 6. What are the request parameters?

- `lastName`: default empty
- `page`: zero-based, default `0`
- `size`: default `10`; allowed values are `5`, `10`, and `20`
- `sort`: default `name`; allowed values are `name`, `address`, `city`, `telephone`, and `pets`
- `direction`: default `asc`; allowed values are `asc` and `desc`

Invalid values return HTTP 400 instead of being silently normalized by the backend.

## 7. How is Name sorted?

Sort by last name, then first name, then ID. This matches clinic lookup behavior even though the
cell displays first name before last name.

## 8. How is Pets sorted?

Sort by pet count because a collection of names has no natural scalar ordering. Keep pet names
visible. Resolve ties by owner last name, first name, and ID. The Pets header's accessible label is
"Sort by number of pets."

## 9. How are other ties resolved?

Address, city, and telephone use the selected field and direction, followed by owner last name,
first name, and ID ascending. Every page boundary is deterministic.

## 10. How does filtering interact with paging?

Preserve the existing case-sensitive last-name prefix semantics and trim surrounding input
whitespace. Submitting a search resets to page 0 while retaining size and sort. Changing sort or
page size also resets to page 0.

## 11. Does list state live in the URL?

Yes. Normalized query parameters are the source of truth so refresh, deep links, and browser Back
restore the same search, page, size, and sort.

## 12. How does the UI issue requests?

Route query changes feed one RxJS `switchMap`, which cancels stale HTTP requests. While loading,
retain the current rows but disable paging and sorting controls. Show loading, empty, error, and
loaded states distinctly.

## 13. Which UI controls are used?

Keep the native Bootstrap-styled table. Use Angular Material `MatSort` headers for accessible
sorting, the repository's `<app-combo>` for page size, and compact Previous/Next controls with
current-page and total text.

Do not introduce `MatTable` or `MatPaginator`; they would conflict with the existing table style
and bypass the design-system combo.

## 14. Offset or cursor pagination?

Use offset/page-number pagination. The requirement exposes page sizes and page navigation, and
100,000 rows with the default SLA below 10 seconds does not justify cursor complexity. Stable
tie-breakers reduce page-boundary ambiguity.

## 15. Which indexes are required?

The current schema has no indexes on owner fields and already has `pets(owner_id)`. Do not add five
speculative sort indexes. Benchmark representative first, middle, and final pages at 100,000
owners. Add a focused Flyway index migration only when `EXPLAIN ANALYZE` or endpoint timings show a
path threatens the 10-second SLA. Start investigation with the default last-name-prefix and name
ordering path.

## 16. What proves completion?

- Focused backend tests for the page envelope, filtering, every sort option, deterministic ties,
  allowed page sizes, and invalid parameters
- Focused Angular service and component tests for URL state, cancellation, reset behavior, bounds,
  and rendering
- A readable Gherkin UI journey covering pagination and sorting without mutating shared owner data
- Regenerated OpenAPI and TypeScript contracts with drift checks passing
- Successful backend and frontend builds
- A benchmark against 100,000 owners covering filtered and unfiltered first, middle, and final pages

## Scope Boundaries

Included: Owners-grid pagination, sorting, last-name search, its REST contract, generated frontend
types, focused tests, one UI acceptance journey, and evidence-driven indexing.

Excluded: cursor pagination, an unbounded compatibility endpoint, owner-detail DTO changes,
case-insensitive or contains search, deleting `/api/owners/count`, seeding 100,000 owners in normal
development data, and broad Angular Material restyling.
