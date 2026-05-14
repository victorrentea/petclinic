## Why

Clinic staff cannot currently see which veterinarian handled a visit, and they cannot choose a veterinarian when recording a new visit. This makes visit records incomplete and prevents the UI from reflecting who is responsible for each consultation.

## What Changes

- Add veterinarian information to the visit data shown in the pet visit list/grid.
- Add a veterinarian dropdown to both the New Visit and Edit Visit forms, populated from the veterinarians that already exist in the clinic.
- Show the assigned veterinarian in the visit list/view used from the pet and owner flows.
- Persist the selected veterinarian as part of visit creation so the same data is available wherever visits are displayed.

## Capabilities

### New Capabilities
- `visit-veterinarian-selection`: Support assigning or changing a visit's veterinarian from existing veterinarian records and displaying that veterinarian in visit listings and visit views.

### Modified Capabilities

## Impact

- Frontend visit create/edit/view/list components under `petclinic-frontend/src/app/visits/` and any pet/owner screens that render visit information.
- Frontend models and services that load or submit visit data.
- Backend visit API and persistence model if veterinarian is not already part of the visit payload.
