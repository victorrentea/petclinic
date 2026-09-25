# Proposal

## Why

The Owners grid currently retrieves every owner together with nested pet and visit data, which is not viable for the projected 100,000-owner dataset. Server-side paging and sorting are needed to keep the grid responsive and the API bounded.

## What Changes

- Add server-side pagination, last-name prefix filtering, and sorting for every displayed Owners-grid column.
- Add selectable page sizes of 5, 10, and 20 rows, with 10 as the default.
- Return lightweight owner rows containing pet names but no visit data.
- Preserve grid state in URL query parameters and cancel stale browser requests.
- Add explicit loading, empty, error, page-boundary, and accessible sorting behavior.
- Benchmark representative queries against 100,000 owners before adding any targeted index.
- **BREAKING** Replace the array returned by `GET /api/owners` with an explicit page envelope.

## Capabilities

### New Capabilities

- `owner-grid-browsing`: Browse, filter, sort, and page through the Owners grid using a bounded server-side REST contract.

### Modified Capabilities

None.

## Impact

- Backend owner REST DTOs, controller, mapper, and repositories
- Generated OpenAPI contract and generated frontend TypeScript types
- Angular Owners-grid state, service, template, styling, module imports, and tests
- Cross-stack Gherkin acceptance coverage and generated sequence artifacts
- Potential Flyway index migration and generated database artifacts, only when measurement justifies it
- Existing frontend and test consumers of `GET /api/owners`, all maintained in this repository
