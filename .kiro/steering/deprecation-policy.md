---
inclusion: auto
---

# Deprecation Policy

## When Replacing Existing APIs or Methods

When creating specs that involve replacing existing functionality (APIs, methods, interfaces), ALWAYS ask the user proactively about deprecation strategy:

**Question to ask:**
"Văd că înlocuim funcționalitatea existentă. Vrei să:
1. **Ștergem imediat** metoda/API-ul vechi (immediate migration)
2. **Păstrăm o perioadă de deprecare** pentru backward compatibility?"

## Default Behavior

- **DO NOT assume** a deprecation period by default
- **DO NOT include** "Phase 4: Cleanup (Future)" tasks without explicit user confirmation
- **ALWAYS ask explicitly** before deciding on the migration strategy

## Implementation Guidelines

### Option 1: Immediate Migration (Ștergere imediată)
- Remove old methods/APIs in the same sprint
- Update all callers simultaneously
- Add cleanup tasks to tasks.md
- Simpler codebase, but requires coordinated deployment

### Option 2: Deprecation Period (Perioadă de deprecare)
- Keep both old and new APIs temporarily
- Add @Deprecated annotations with removal timeline
- Log deprecation warnings
- Document migration path for clients
- Schedule cleanup for future version
- Safer rollout, but more complex codebase temporarily

## Task Planning Impact

When user chooses **immediate migration**:
- Add explicit cleanup tasks (e.g., "Remove deprecated X method")
- Ensure all references are updated in the same spec
- Include tasks for updating all callers

When user chooses **deprecation period**:
- Document the deprecation timeline in design.md
- Add logging/warning tasks
- Note cleanup as "Future" work, not in current tasks.md
- Document backward compatibility approach

## Examples

### Immediate Migration Task
```markdown
- [ ] 1.2 Remove deprecated findByNameAndAddress method from OwnerRepository
  - Delete the old findByNameAndAddress method
  - _Requirements: Cleanup for immediate migration_
```

### Deprecation Period Approach
```markdown
- [ ] 1.2 Add @Deprecated annotation to findByNameAndAddress
  - Mark method as deprecated with removal date
  - Add log warning when old method is called
  - Document migration path in JavaDoc
  - _Requirements: Backward compatibility during transition_
```

## Key Principle

**User decides the migration strategy** - we implement their choice, not assume one approach is always better.
