# Design: add-vet-to-visit

## Context

Visit (`visit.entity.ts`) currently relates only to Pet (`@ManyToOne` + `pet_id`). Vet (`vet.entity.ts`) has no visits relation. `VisitDto` already flattens related data (`petName`, `ownerFirstName`, `ownerLastName`) — the vet fields follow the same pattern. The frontend renders visits in two distinct tables: the visits page table (`visits-page.component.html`, `#visitsTable`) and the reusable `visit-list` component (embedded in owner-detail via pet-list, and in visit-add as "Previous Visits"). Contract drift is policed by guardrails (schema-sync spec, openapi.yaml diff, generated api-types.ts).

## Goals / Non-Goals

**Goals:**
- A visit always records the vet who served it — required at creation; existing rows backfilled.
- Vet identity visible on every surface that renders visits (REST, MCP, both frontend tables).
- Vet selected in visit add/edit via a required dropdown fed by existing `GET /api/vets`.

**Non-Goals:**
- Vet availability/scheduling, specialty matching, or validation that the vet's specialty fits the pet.
- Filtering/sorting visits by vet.
- A "visits per vet" view on the vets page.
- Multiple vets per visit (one serving vet; revisit if the business asks).

## Decisions

1. **Required `vet_id NOT NULL` FK on `visits`** — the business rule mandates recording the serving vet. The migration backfills all existing rows deterministically *before* adding the constraint. Alternative (nullable) rejected: the rule is blunt — no visit without a vet.
2. **New migration `1700000000004-AddVetToVisit`** (column + FK + index + backfill + `SET NOT NULL`) — `vets` is created in `1700000000002`, *after* `visits`, so the column cannot live in `1700000000001`; a new migration avoids reordering and works on already-migrated databases. The schema-sync guardrail validates entities against the *cumulative* migration schema.
3. **Flattened DTO fields (`vetId`, `vetFirstName`, `vetLastName`)** mirroring the existing owner/pet flattening — keeps frontend tables binding-trivial and avoids nested DTO churn in openapi.yaml. Alternative (nested `vet` object) rejected for consistency.
4. **`vetId` required on `VisitDto` for create/update (`@IsInt`/`@Min(1)`); vet names are response-only** — same write/read split the DTO already uses for pet/owner fields. Mapper creates a `Vet` stub from `vetId` (same pattern as the pet stub in `toVisit()`).
5. **Controller queries keep `leftJoinAndSelect('v.vet', ...)`** defensively, though after backfill + NOT NULL every visit has a vet.
6. **Frontend dropdown reuses `VetService.getVets()`** — required field, NO empty option, label "FirstName LastName"; form invalid until a vet is selected; edit preselects the current vet.
7. **MCP `createVisit` requires `vetId` (validated against existing vets); `listVisits`/`VisitView` gain the three vet fields** — keeps MCP parity with REST.

## Risks / Trade-offs

- [**BREAKING** for API/MCP clients creating visits] → backend, frontend, and MCP tooling ship together; 400 with a clear message when `vetId` is missing.
- [Backfill picks arbitrary vets for historical visits] → deterministic assignment (vet = `id % 6 + 1`) so e2e/Playwright expectations are stable; acceptable for sample data.
- [Playwright visits test builds expected rows from the API] → update `VisitsPage.ts`/`api-client.ts` in the same change, otherwise CI fails on the new column.
- [openapi.yaml/api-types.ts drift] → regenerate both as explicit tasks; guardrail CI enforces.
- [Deleting a vet with visits] → plain FK (RESTRICT default) blocks it; vets are not deletable via UI today — revisit if vet deletion arrives.

## Migration Plan

1. Single migration `1700000000004`: add column → backfill all rows → `SET NOT NULL` (one deploy, no intermediate nullable state).
2. Backend + frontend + MCP client updates deploy together (breaking create/update contract).
3. Rollback: revert migration (drop column) + redeploy previous backend/frontend pair.

## Open Questions

- None blocking.