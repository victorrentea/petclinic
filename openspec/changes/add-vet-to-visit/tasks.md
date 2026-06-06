# Tasks: add-vet-to-visit

## 1. Backend — data model (TDD)

- [ ] 1.1 RED: extend `test/visit.e2e-spec.ts` — getAll/getById expect `vetId`/`vetFirstName`/`vetLastName` on every seeded visit; create with `vetId` round-trips; create/PUT WITHOUT `vetId` → 400
- [ ] 1.2 New migration `1700000000004-AddVetToVisit.ts`: add `vet_id INT REFERENCES vets(id)` + index; backfill ALL visits deterministically (vet = `id % 6 + 1`); then `SET NOT NULL`
- [ ] 1.3 `visit.entity.ts`: `@ManyToOne(() => Vet)` + `@JoinColumn({ name: 'vet_id' })`, non-nullable; `vet.entity.ts`: inverse `@OneToMany`
- [ ] 1.4 Schema-sync guardrail passes (`test/guardrails/schema-sync.spec.ts`)

## 2. Backend — API + MCP (TDD)

- [ ] 2.1 `dto/visit.dto.ts`: required `vetId` (`@IsInt`/`@Min(1)`) + response-only `vetFirstName`/`vetLastName`, Swagger annotations matching existing owner/pet flattening
- [ ] 2.2 `visit.mapper.ts`: vet stub from `vetId` in `toVisit()`; flatten vet fields in `toVisitDto()`
- [ ] 2.3 `visit.controller.ts`: `leftJoinAndSelect('v.vet', ...)` in `listVisits()`; `vet: true` in `getVisit()`/`findByIdOrThrow()` relations
- [ ] 2.4 GREEN: e2e tests from 1.1 pass
- [ ] 2.5 MCP `mcp/tools/visit.tools.ts`: vet fields on `VisitView` + `listVisits()`; REQUIRED `vetId` param on `createVisit()` validated against existing vets; update tool registration schema + MCP tests
- [ ] 2.6 Regenerate `openapi.yaml` (`npm run guardrail:openapi:generate`) and verify `npm run guardrail:openapi`

## 3. Frontend

- [ ] 3.1 Regenerate `api-types.ts` (`npm run generate:api` in petclinic-frontend)
- [ ] 3.2 `visit-add`: inject `VetService`, load vets, REQUIRED dropdown (no empty option, label "First Last"), submit `vetId`, form invalid without selection
- [ ] 3.3 `visit-edit`: same required dropdown, preselect current `vetId`
- [ ] 3.4 `visit-list.component.html`: Vet column (`vetFirstName vetLastName`) — covers owner detail + "Previous Visits"
- [ ] 3.5 `visits-page.component.html`: Vet column after Owner (`td.visit-vet`)
- [ ] 3.6 Update/extend Karma tests touched by the above; `npm run test-headless`

## 4. UI tests (Playwright)

- [ ] 4.1 `tests/support/api-client.ts`: vet fields on `VisitDto`
- [ ] 4.2 `tests/pages/VisitsPage.ts`: `vetFullName` in `VisitRow` + `td.visit-vet` extraction
- [ ] 4.3 `tests/visits.spec.ts`: expected rows include `vetFullName`; new scenario creating a visit selecting a vet and asserting it appears in the lists
- [ ] 4.4 Run the Playwright suite against the full stack

## 5. Wrap-up

- [ ] 5.1 Full backend test suite + guardrails green
- [ ] 5.2 Manual smoke: `/visits`, owner detail, add + edit visit with required vet