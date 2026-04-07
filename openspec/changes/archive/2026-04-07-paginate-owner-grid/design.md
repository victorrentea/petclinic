## Context

Owners list currently loads all records. Backend uses Spring Data JPA; frontend Angular renders a table. No pagination in API or UI.

## Goals / Non-Goals

**Goals:**
- Add server-side pagination using Spring Data `Pageable`
- Expose paginated API (`page`, `size`, `sort`)
- Update UI to consume paged results and provide controls

**Non-Goals:**
- Infinite scroll
- Caching or advanced filtering redesign

## Decisions

- **Server-side pagination (Pageable)**: avoids large payloads; standard in Spring. Alternative: client-side pagination (rejected due to scalability).
- **OpenAPI contract changes**:
  - Endpoint `GET /api/owners` accepts query params: `page` (int, 0-based), `size` (int, allowed: 10|20|50), `sort` (string), `q` (string, free-text search across fields).
  - Response schema becomes paginated:
    - `content: Owner[]`
    - `number: number` (current page)
    - `totalElements: number`
    - `totalPages: number`
    - `size: number`
  - No DB schema changes required.
- **Page size selectable (10/20/50)** via UI dropdown.
- **Frontend pagination model in URL**: `?page=&size=&sort=&q=` to support refresh and shareable links.
- **Pagination UI window**: show current page, 2 before and 2 after, always show first 3 pages, last 2 pages, and a middle page indicator when gaps exist.

## Risks / Trade-offs

- Inconsistent sorting between pages → require explicit `sort` or default stable sort by `id`
- Breaking API consumers → keep endpoint, params optional (defaults applied)
- UX confusion on filters reset → persist `page,size,sort,q` in URL
