## 1. Backend

- [ ] 1.1 Update OwnersController to accept page, size, sort params
- [ ] 1.2 Update service to use Pageable
- [ ] 1.3 Update repository call to return Page<Owner>
- [ ] 1.4 Map Page<Owner> to DTO with metadata
- [ ] 1.5 Add default sorting (lastName,id)
- [ ] 1.6 Add/adjust tests for pagination scenarios

## 2. Frontend

- [ ] 2.1 Update owners service to call API with pagination params
- [ ] 2.2 Update owners component to store page state
- [ ] 2.3 Add pagination UI (prev/next + size selector)
- [ ] 2.4 Bind UI controls to API calls
- [ ] 2.5 Preserve filters/search in query params
- [ ] 2.6 Update/extend component tests

## 3. Integration

- [ ] 3.1 Verify end-to-end pagination behavior
- [ ] 3.2 Validate performance with large dataset
- [ ] 3.3 Ensure backward compatibility (no params still works)
