## 1. Backend visit veterinarian support

- [x] 1.1 Add nullable veterinarian association to the visit domain model, repository loading, and database schema.
- [x] 1.2 Extend visit DTOs and MapStruct mappings to accept `vetId` on create/update and return veterinarian identity on reads.
- [x] 1.3 Update visit REST endpoints so create, edit, read, and list flows persist and expose veterinarian assignment while preserving legacy visits without a vet.

## 2. Frontend visit data integration

- [x] 2.1 Regenerate or refresh frontend API types and visit/vet models to include visit veterinarian fields.
- [x] 2.2 Update the New Visit and Edit Visit screens to load veterinarians from the existing vets service, require a dropdown selection, and preselect the current veterinarian on edit.
- [x] 2.3 Update visit list/detail rendering used by the global visits page and pet/owner visit history to show veterinarian name or `Unassigned`.

## 3. Verification

- [x] 3.1 Add or update automated tests covering visit creation/editing with veterinarian selection and visit display with veterinarian data.
- [x] 3.2 Verify legacy visits without a veterinarian still render correctly across visit screens.
