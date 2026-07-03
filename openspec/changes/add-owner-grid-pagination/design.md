## Context

Issue #25 upgrades the Owners grid from an all-records list into a production
scale browsing surface. The current frontend loads `Owner[]` from
`GET /api/owners`, the backend returns a plain `List<OwnerDto>`, and the grid
has no pagination or sorting. Repository guidance now requires server-side
sorting and pagination for large tables because Owners can reach roughly 1M
rows in production.

This change spans backend REST contract, repository querying, generated OpenAPI
types, frontend data loading, and frontend grid rendering. The user already
chose two notable constraints: `GET /api/owners` itself will change rather than
adding a parallel endpoint, and the response shape will expose Spring page
JSON.

## Goals / Non-Goals

**Goals:**
- Return owners through server-side pagination on `GET /api/owners`.
- Support sorting by Name, Address, City, and Telephone.
- Keep last-name prefix filtering and combine it with paging and sorting.
- Update the grid to display owner names as `lastName firstName`.
- Keep the page experience stable through deterministic default sorting and
  reset behavior.

**Non-Goals:**
- Make the Pets column sortable.
- Introduce a reusable shared grid framework for the rest of the application.
- Redesign the Owners page beyond the controls needed for sorting and paging.
- Preserve backward compatibility for clients expecting `GET /api/owners` to
  return a bare array.

## Decisions

### 1. Change `GET /api/owners` to accept paging and sorting parameters

The endpoint will accept `lastName`, `page`, `size`, and `sort`, and it will
return Spring page JSON. This matches the user decision to evolve the existing
endpoint instead of adding a second contract.

**Alternatives considered**
- Add a new paged endpoint: safer migration, but rejected because the user chose
  to change the existing endpoint.
- Return a custom page DTO: cleaner contract, but rejected because the user
  explicitly chose Spring page JSON.

### 2. Implement paging and sorting in the repository layer with Spring Data

`OwnerRepository` will move to a Spring Data repository type that supports
`Pageable` queries, and owners will be queried with last-name prefix filtering
plus pageable sorting. This keeps the 1M-row constraint enforceable at the data
access layer instead of simulating paging in memory.

**Alternatives considered**
- Load then slice/sort in memory: rejected because it breaks the scalability
  requirement.
- Keep the custom repository signature and hand-build paging: possible, but more
  code for no clear gain over Spring Data support.

### 3. Define sortable columns explicitly

The grid will expose sorting on Name, Address, City, and Telephone only. Name
sorting will map to `lastName`, then `firstName`. Pets remains visible but not
sortable because it is a collection and the user explicitly rejected synthetic
sorting semantics for it.

**Alternatives considered**
- Sort Pets by count or concatenated pet names: rejected as misleading and not
  required.
- Sort Name by first name first: rejected because the screen already centers on
  last-name search semantics.

### 4. Use stable defaults for reproducible paging

Default page size will be 5. Allowed page sizes will be 5, 10, and 20. Default
sorting will be `lastName,asc`, then `firstName,asc`, then `id,asc` so page
boundaries stay stable even when names collide.

**Alternatives considered**
- Default size 10 or 20: acceptable, but 5 better matches the issue language
  and keeps the first rollout conservative.
- Default sort by id only: stable, but less useful to end users.

### 5. Reset paging when the result set definition changes

The frontend will reset to page 0 whenever the last-name filter, active sort,
or page size changes. Paging state should not carry over across different result
sets because that creates empty or misleading pages.

**Alternatives considered**
- Preserve current page across filter/sort changes: rejected because page
  numbers lose meaning when the underlying ordering or subset changes.

### 6. Regenerate OpenAPI and frontend generated types as part of the change

Because `GET /api/owners` is a contract change, the Java annotations,
`openapi.yaml`, and `petclinic-frontend/src/app/generated/api-types.ts` must
move together. This keeps the generated frontend types aligned with the backend
response shape.

**Alternatives considered**
- Hand-edit frontend API types: rejected because the repository treats them as
  generated artifacts.

### 7. Use Hibernate batch fetching to mitigate owner-to-pets fan-out

The paged owners flow will keep using JPA/JPQL rather than native SQL, and the
lazy `Owner.pets` collection will use batch fetching to reduce the N+1 query
pattern when the grid still needs pet data per row. This keeps the solution in
the current ORM model while avoiding one follow-up query per owner.

**Alternatives considered**
- Native SQL tuned specifically for this grid: rejected because the user
  explicitly does not want native queries for this page.
- Leaving lazy loading unoptimized: rejected because it risks N+1 behavior on
  every owners page.
- `JOIN FETCH` on the paged list query: rejected because paginating parent rows
  with a fetched collection is a poor fit and can distort row counts.

## Risks / Trade-offs

- **Breaking API contract for `/api/owners`** → Update backend tests, generated
  OpenAPI, generated frontend types, and the current UI in one change.
- **Spring page JSON leaks framework-specific fields** → Accept the noisier
  contract because the user explicitly chose it.
- **Owner DTO still includes pets for each row** → Keep scope focused on the
  issue; rely on server-side paging to cap row volume per request and batch
  fetching to reduce follow-up query count.
- **Sorting by displayed Name requires mapping UI state to multiple backend sort
  fields** → Handle Name as a special frontend-to-backend sort translation.
- **No existing reusable paged grid pattern exists in the frontend** → Keep the
  implementation local to Owners instead of over-generalizing.
