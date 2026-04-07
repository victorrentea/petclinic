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
- **API response = Spring Page mapped to DTO**: include `content`, `totalElements`, `totalPages`, `number`. Alternative: custom wrapper (unnecessary).
- **Default page size = 20**: balance between payload and usability. Configurable later.
- **Frontend controls = simple pager (prev/next + size select)**: minimal change, consistent with Bootstrap. Alternative: Angular Material paginator (heavier, style mismatch).

## Risks / Trade-offs

- Inconsistent sorting between pages → enforce default sort by `lastName,id`
- Breaking API consumers → keep existing endpoint but extend with optional params
- UX confusion on filters reset → persist query params in URL
