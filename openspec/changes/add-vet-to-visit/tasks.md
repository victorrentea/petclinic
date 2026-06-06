# Tasks: add-vet-to-visit

## 1. Backend — data model (TDD)

- [x] 1.1 RED: extend `test/visit.e2e-spec.ts` — getAll/getById expect `vetId`/`vetFirstName`/`vetLastName` on every seeded visit; create with `vetId` round-trips; create/PUT WITHOUT `vetId` → 400
- [x] 1.2 New migration `1700000000004-AddVetToVisit.ts`: add `vet_id INT REFERENCES vets(id)` + index; backfill ALL visits deterministically (vet = `id % 6 + 1`); then `SET NOT NULL`
- [x] 1.3 `visit.entity.ts`: `@ManyToOne(() => Vet)` + `@JoinColumn({ name: 'vet_id' })`, non-nullable; `vet.entity.ts`: inverse `@OneToMany`
- [x] 1.4 Schema-sync guardrail passes (parser extended for `ALTER TABLE ADD COLUMN` + migration 04 registered)

## 2. Backend — API + MCP (TDD)

- [x] 2.1 `dto/visit.dto.ts`: required `vetId` (`@IsDefined`/`@Min(1)`, house style) + response-only `vetFirstName`/`vetLastName`, Swagger annotations matching existing owner/pet flattening; same on `VisitFieldsDto` (PUT body)
- [x] 2.2 `visit.mapper.ts`: vet stub from `vetId` in `toVisit()`/`toVisitFromFields()`; flatten vet fields in `toVisitDto()`
- [x] 2.3 `visit.controller.ts`: `leftJoinAndSelect('v.vet', ...)` in `listVisits()`; `vet: true` in `findByIdOrThrow()` relations; vet stub in `updateVisit()`
- [x] 2.4 GREEN: e2e tests from 1.1 pass (12/12)
- [x] 2.5 MCP `mcp/tools/visit.tools.ts`: vet fields on `VisitView` + `listVisits()`; REQUIRED `vetId` param on `createVisit()` validated against existing vets; tool schema + module wiring + new `visit.tools.spec.ts` (TDD)
- [x] 2.6 Regenerate `openapi.yaml` (`npm run guardrail:openapi:generate`) and verify `npm run guardrail:openapi`; root `openapi.yaml` (frontend contract) patched with the vet fields too
- [x] 2.7 (discovered in smoke) owner + pet endpoints join `visit.vet` so owner-detail and "Previous Visits" lists carry the vet — TDD via `getById_returnsVisitsWithVet` in owner+pet e2e specs

## 3. Frontend

- [x] 3.1 Regenerate `api-types.ts` (`npm run generate:api` in petclinic-frontend)
- [x] 3.2 `visit-add`: inject `VetService`, load vets, REQUIRED dropdown (no empty option, label "First Last"), submit `vetId`, form invalid without selection
- [x] 3.3 `visit-edit`: same required dropdown, preselect current `vetId`
- [x] 3.4 `visit-list.component.html`: Vet column (`vetFirstName vetLastName`) — covers owner detail + "Previous Visits"
- [x] 3.5 `visits-page.component.html`: Vet column after Owner (`td.visit-vet`)
- [x] 3.6 Karma tests updated (Karma 111/111 green) + strict build clean

## 4. UI tests (Playwright)

- [x] 4.1 `tests/support/api-client.ts`: vet fields on `VisitDto`
- [x] 4.2 `tests/pages/VisitsPage.ts`: `vetFullName` in `VisitRow` + `td.visit-vet` extraction
- [x] 4.3 `tests/visits.spec.ts`: expected rows include `vetFullName`; new scenario creating a visit selecting a vet and asserting it appears in the lists
- [x] 4.4 Playwright suite vs full stack: 6/6 PASS (backend on isolated petclinic_test DB)

## 5. Wrap-up

- [x] 5.1 Full backend test suite + guardrails green (unit 22/22, e2e 72/72, schema 6/6, openapi in sync, Karma 111/111, Playwright 6/6)
- [x] 5.2 Manual smoke (screenshots): `/visits` cu coloana Vet, owner detail cu vet, edit preselectează vet-ul; add acoperit de scenariul Playwright