# Proposal: add-vet-to-visit

## Why

Users asked to record which veterinarian served each visit. Today a Visit only knows its pet, date, and description — the clinic cannot tell who performed the consultation, neither in the UI nor through the API/MCP tools.

## What Changes

- Visit gains a **required** association to the Vet who served it (`vet_id` FK on `visits`, `NOT NULL` after a deterministic backfill of existing rows).
- `VisitDto` exposes `vetId`, `vetFirstName`, `vetLastName`. **BREAKING**: `POST /api/visits` and `PUT /api/visits/:id` now require `vetId` (400 without it).
- Visit add and edit forms get a **required** vet dropdown (populated from the existing `GET /api/vets`, no empty option — the form cannot submit without a vet).
- The vet (first + last name) is shown next to each visit on **every surface that renders visits**:
  - Visits page table (`/visits`: Date | Description | Pet | Owner | **Vet**)
  - Reusable visit-list component (used in owner detail "Pets and Visits" and in visit-add "Previous Visits")
- MCP `listVisits` tool returns the vet fields. **BREAKING**: MCP `create_visit` now requires a `vetId`.
- New migration backfills all existing/seeded visits with deterministic vets, then enforces `NOT NULL`.
- Guardrail artifacts regenerated: `openapi.yaml` and frontend `api-types.ts`.

## Capabilities

### New Capabilities

- `visit-vet-association`: data model + API — a visit records the vet who served it (required at creation); visit responses expose the vet's identity; visit create/update requires a `vetId`; MCP visit tools reflect the same.
- `visit-vet-ui`: frontend — required vet dropdown in visit add/edit forms; vet displayed alongside every rendered visit row (visits page table and the reusable visit-list component).

### Modified Capabilities

(none — no existing specs)

## Impact

- **Backend** (`petclinic-backend-ts/`): `visit.entity.ts`, `vet.entity.ts` (inverse relation), `visit.dto.ts`, `visit.mapper.ts`, `visit.controller.ts` (join vet), new migration `1700000000004-AddVetToVisit` (column + backfill + NOT NULL), `mcp/tools/visit.tools.ts`.
- **Frontend** (`petclinic-frontend/`): `visit-add` and `visit-edit` components (required vet dropdown via existing `VetService`), `visit-list.component.html` (vet column), `visits-page.component.html` (vet column), `visit.ts` model.
- **Contracts**: `openapi.yaml` regenerated (`guardrail:openapi:generate`), `api-types.ts` regenerated (`generate:api`); schema-sync guardrail covers the new column.
- **Tests**: backend `visit.e2e-spec.ts`, Playwright `visits.spec.ts` + `VisitsPage.ts` + `api-client.ts`.
- **BREAKING**: API clients and MCP clients creating/updating visits must send `vetId`; backend, frontend, and MCP tooling ship together.