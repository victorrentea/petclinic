## Context

Visits currently store and expose the visit date, description, pet, and owner context, but they do not carry veterinarian assignment. The frontend already has a `VetService` and vet model, while visit screens are split across a global visits page, the pet/owner visit list component, and the new/edit visit forms. The backend visit API uses `VisitDto` for reads and creates, `VisitFieldsDto` for updates, and the frontend consumes generated OpenAPI types, so any API shape change must stay aligned across backend DTOs and generated frontend types.

## Goals / Non-Goals

**Goals:**
- Allow staff to choose an existing veterinarian when creating a visit.
- Allow staff to change the assigned veterinarian when editing a visit.
- Persist the selected veterinarian on the visit record.
- Expose veterinarian identity in visit API responses so all visit UIs can render it.
- Show veterinarian information in the visit grid/list rendered from pet, owner, and visits pages.

**Non-Goals:**
- Introducing veterinarian scheduling, availability, or any new veterinarian status beyond the existing veterinarian records.
- Redesigning visit navigation or replacing the existing visit list component.
- Backfilling historical visits with a veterinarian beyond providing a safe legacy display state.

## Decisions

### Store a nullable `vet_id` relationship on `Visit`
Visits should reference `Vet` directly in the domain model and database. The relationship remains nullable during rollout so existing rows continue to load without data migration, while all new visits created from the UI must provide a veterinarian.

**Alternatives considered:**
- Store veterinarian name as plain text on the visit: rejected because it denormalizes staff data and becomes stale when a vet record changes.
- Require an immediate database backfill before rollout: rejected because there is no source of truth for historical veterinarian assignments.

### Extend visit DTOs with veterinarian identity fields
Read models should expose both `vetId` and a server-populated veterinarian display name so visit grids can render without extra per-row vet lookups. Create/update payloads should accept `vetId` rather than nested vet objects to keep the API compact and aligned with existing `petId` handling.

**Alternatives considered:**
- Return a nested `VetDto`: rejected because visit screens only need identifier and display name, and generated frontend types stay simpler with flattened fields.
- Resolve veterinarian names in the frontend by fetching all vets and joining client-side: rejected because it duplicates mapping logic and makes list rendering depend on multiple calls.

### Reuse the existing `VetService` for the New Visit and Edit Visit dropdowns
The New Visit and Edit Visit screens should load all existing veterinarians through the current vets endpoint and bind them to a required dropdown. Edit must preselect the visit's current veterinarian so create and edit follow the same mental model and UI behavior. This keeps the source of truth in one place and avoids adding visit-specific lookup endpoints or veterinarian lifecycle state.

**Alternatives considered:**
- Add a dedicated `/visits/metadata` endpoint: rejected because current vet data is already available and sufficient.
- Hardcode veterinarian options into the form: rejected because it would drift from the existing veterinarian records.

### Render a deterministic fallback for legacy visits
If a visit has no assigned veterinarian, visit lists and reused visit views should show `Unassigned` instead of an empty cell. This preserves readability while making legacy data gaps explicit.

**Alternatives considered:**
- Leave the value blank: rejected because users cannot distinguish missing data from rendering issues.

## Risks / Trade-offs

- **Legacy rows remain without a veterinarian** -> Mitigate by allowing nullable persistence temporarily and showing `Unassigned` in the UI.
- **DTO changes require regenerated frontend types** -> Mitigate by treating the OpenAPI contract update and generated type refresh as part of the same implementation task.
- **Visit create/edit flows gain an extra lookup request** -> Mitigate by reusing the existing vets endpoint once at form load and keeping the dropdown data small.
- **Edit form can overwrite veterinarian accidentally if current selection is not preloaded** -> Mitigate by loading the existing `vetId` with the visit and preselecting it in the dropdown before save.

## Migration Plan

1. Add nullable `vet_id` support in the visit persistence model and database schema.
2. Extend visit API DTOs and mappings to accept and return veterinarian identity.
3. Regenerate frontend API types and adapt visit screens to the new fields.
4. Roll out UI changes with `Unassigned` rendering for legacy visits.
5. Optionally tighten the database constraint later after historical cleanup, outside this change.

## Open Questions

- None.
