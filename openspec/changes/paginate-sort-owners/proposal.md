# Proposal

## Why

The Owners grid currently downloads every matching owner and maps their pets and visits,
which does not fit the business estimate of 100,000 owners within one year.
Issue #25 and the decisions in [Q&A.md](../../../Q&A.md) require bounded server-side
browsing, global sorting, and restorable search context.

## What Changes

- Add server-side pagination with page sizes 5, 10, and 20; default to 10.
- Sort Name, Address, City, and Telephone across the complete filtered result.
  Display names as "Last name, First name"; Pets remains explicitly unsortable.
- Preserve explicit last-name prefix search, with page reset on search, sorting,
  and page-size changes.
- Store applied browsing state in URL parameters and restore it on refresh and Back/Forward.
- Show navigation, totals, loading, retryable errors, and distinct empty states.
- Bound database work to the selected owners and their related data; prevent N+1 queries.
- **BREAKING**: change `GET /api/owners` from an array to an explicit page envelope.
  Update known frontend and test consumers and regenerate the API contract and TypeScript types.
  Do not keep a separate unpaginated compatibility endpoint.

## Capabilities

### New Capabilities

- `owners-browsing`: Searching, globally sorting, and paging owners through the API
  and grid, including URL state, feedback, and bounded retrieval.

### Modified Capabilities

None. The OpenSpec capability inventory is currently empty.

## Impact

- Backend: `OwnerRestController`, owner repository queries, list mapping/page DTOs,
  OpenAPI annotations/examples, and focused integration tests.
- Frontend: Owners service/list/template/styles/module, existing `OwnerPage` type,
  router state, and related tests. Reuse the design-system combo for page size.
- Contract: regenerate root `openapi.yaml` with `OpenApiExtractorTest`, then generated
  frontend types; retain owner detail/write and MCP contracts.
- Tests: update array-based REST fixtures/assertions in backend functional tests,
  Playwright/Cucumber setup, and the optional owner latency-proxy performance test.
- Documentation: update the Owners user-manual section and keep Q&A decision provenance.
- No new runtime dependency, service layer, deployment connection, or generic grid framework.
  No index or schema migration is assumed; any later need must follow measurement.
- The chatbot uses `/mcp` and direct repository-backed tools, not this REST list.
  Unknown external consumers, if any, must migrate with the breaking contract.
