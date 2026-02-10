# Implementation Plan: Owner Search Feature Enhancement

**Date:** February 9, 2026  
**Status:** ✅ Completed  
**Test Results:** 27/27 tests passing

---

## Objective
Change the owner search endpoint from searching only by `lastName` (starts-with) to searching by `name` (contains, case-insensitive) in both `firstName` and `lastName` fields.

---

## Requirements Analysis

### Frontend Team Request
- **Old:** `GET /api/owners?lastName=Davis` (exact start match on lastName only)
- **New:** `GET /api/owners?name=Davis` (contains match on firstName OR lastName)

### Search Behavior Changes
| Aspect | Before | After |
|--------|--------|-------|
| Parameter name | `lastName` | `name` |
| Match type | Starts-with | Contains (substring) |
| Case sensitivity | Case-insensitive | Case-insensitive |
| Fields searched | lastName only | firstName OR lastName |

### Examples
- `?name=ann` matches: "Joann", "Hannah", "Marianne", "Ann"
- `?name=SMI` matches: "Smith" (case-insensitive)
- `?name=eor` matches: "George" (contains in firstName)
- No parameter returns all owners

---

## Implementation Steps

### Step 1: Update Repository Layer ✅
**File:** `OwnerRepository.java`

**Changes:**
```java
// Add new method with custom JPQL query
@Query("SELECT DISTINCT o FROM Owner o LEFT JOIN FETCH o.pets " +
       "WHERE LOWER(o.firstName) LIKE LOWER(CONCAT('%', :name, '%')) " +
       "OR LOWER(o.lastName) LIKE LOWER(CONCAT('%', :name, '%'))")
List<Owner> findByFirstNameOrLastNameContainingIgnoreCase(@Param("name") String name);
```

**Rationale:**
- Custom `@Query` needed for OR condition across two fields
- `LEFT JOIN FETCH` for pets to avoid N+1 query problem
- `LOWER()` and `CONCAT('%', :name, '%')` for case-insensitive contains matching
- `DISTINCT` to handle multiple pets per owner in join

**Note:** Kept existing `findByLastNameIgnoreCaseStartingWith()` method for backward compatibility (not removed)

---

### Step 2: Update Controller Layer ✅
**File:** `OwnerRestController.java`

**Changes:**
```java
// Before:
public List<OwnerDto> listOwners(@RequestParam(name = "lastName", required = false) String lastName) {
    if (lastName != null) {
        owners = ownerRepository.findByLastNameIgnoreCaseStartingWith(lastName);
    } else {
        owners = ownerRepository.findAll();
    }
}

// After:
public List<OwnerDto> listOwners(@RequestParam(name = "name", required = false) String name) {
    if (name != null && !name.isEmpty()) {
        owners = ownerRepository.findByFirstNameOrLastNameContainingIgnoreCase(name);
    } else {
        owners = ownerRepository.findAll();
    }
}
```

**Key Changes:**
- Parameter renamed: `lastName` → `name`
- Repository method switched to new search method
- Added empty string check (treat as null)

---

### Step 3: Update Tests ✅
**File:** `OwnerTest.java`

#### Updated Existing Tests (2)
1. `getAllWithLastNameFilter()` - Changed `?lastName=Davis` → `?name=Davis`
2. `getAllWithLastNameFilter_notFound()` - Changed `?lastName=NonExistent` → `?name=NonExistent`

#### Added New Tests (5)
1. **`searchByFirstName()`**
   - Verifies search works on firstName field
   - Example: `?name=George` finds owner with firstName="George"

2. **`searchByPartialFirstName()`**
   - Verifies contains matching in firstName
   - Example: `?name=eor` finds "George"

3. **`searchByPartialLastName()`**
   - Verifies contains matching in lastName
   - Example: `?name=mit` finds "Smith"

4. **`searchCaseInsensitive()`**
   - Verifies case-insensitive matching
   - Example: `?name=FRANK` finds "Franklin"

5. **`searchByNameMatchesAnnInFirstOrLastName()`**
   - Complex test with multiple owners containing "ann"
   - Validates: Joann, Hannah, Marianne, Ann all matched
   - Demonstrates OR logic across both fields

6. **`searchByNameSMIMatchesSmith()`**
   - Validates case-insensitive uppercase search
   - Example: `?name=SMI` finds "Smith"

---

## Test Coverage Summary

### Total Tests: 27
- **Owner CRUD:** 10 tests (create, read, update, delete)
- **Pet management:** 7 tests (add, update, get pet)
- **Search functionality:** 10 tests (including 5 new search tests)

### Test Execution
```bash
mvn test -Dtest=OwnerTest
# Result: Tests run: 27, Failures: 0, Errors: 0, Skipped: 0
```

---

## SQL Query Analysis

### Generated JPQL Query
```sql
SELECT DISTINCT o1_0.id, o1_0.address, o1_0.city, 
       o1_0.first_name, o1_0.last_name, 
       p1_0.owner_id, p1_0.id, p1_0.birth_date, p1_0.name, p1_0.type_id, 
       o1_0.telephone 
FROM owners o1_0 
LEFT JOIN pets p1_0 ON o1_0.id = p1_0.owner_id 
WHERE LOWER(o1_0.first_name) LIKE LOWER(('%' ? '%')) 
   OR LOWER(o1_0.last_name) LIKE LOWER(('%' ? '%'))
```

### Performance Considerations
- ✅ Single query (no N+1 problem)
- ✅ LEFT JOIN FETCH loads pets eagerly
- ✅ DISTINCT prevents duplicate owners
- ⚠️ LIKE with leading wildcard prevents index usage (acceptable for small datasets)

---

## Files Modified

| File | Lines Changed | Type |
|------|---------------|------|
| `OwnerRepository.java` | +4 | Repository |
| `OwnerRestController.java` | ~10 | Controller |
| `OwnerTest.java` | +45 | Tests |

**Total:** 3 files, ~59 lines changed/added

---

## Backward Compatibility

### Breaking Changes
- ⚠️ Query parameter renamed: `lastName` → `name`
- ⚠️ Search behavior changed: starts-with → contains

### Migration Path for Clients
```javascript
// Before:
GET /api/owners?lastName=Davis

// After:
GET /api/owners?name=Davis
```

**Note:** Old `findByLastNameIgnoreCaseStartingWith()` method kept in repository but not used by controller.

---

## Code Quality Checks

### Followed Coding Standards
- ✅ No unused imports
- ✅ Line length ≤ 120 characters
- ✅ Descriptive method names
- ✅ Concise implementation (KISS principle)
- ✅ Used Spring Data JPA conventions
- ✅ Added comprehensive test coverage
- ✅ No deprecated APIs used

### Security
- ✅ Existing `@PreAuthorize("hasRole(@roles.OWNER_ADMIN)")` preserved
- ✅ SQL injection prevented via parameterized query (`:name`)

---

## Deployment Checklist

- [x] Code implemented
- [x] Unit tests added
- [x] Integration tests passing
- [x] No compilation errors
- [x] No new warnings introduced
- [ ] API documentation updated (Swagger/OpenAPI)
- [ ] Frontend team notified of parameter change
- [ ] Release notes prepared

---

## Known Limitations

1. **Performance:** LIKE with leading wildcard (`%term%`) cannot use database indexes
   - **Impact:** Negligible for small owner tables (<10k records)
   - **Future:** Consider full-text search (Elasticsearch) if performance becomes issue

2. **Special Characters:** No escaping for SQL wildcards (`%`, `_`)
   - **Impact:** Searching for literal `%` or `_` will behave as wildcards
   - **Fix:** Add escape logic if needed: `name.replace("%", "\\%").replace("_", "\\_")`

---

## Future Enhancements (Not Implemented)

1. **Pagination:** Add `@RequestParam Pageable pageable` for large result sets
2. **Additional fields:** Search in `address`, `city`, `telephone`
3. **Advanced filters:** Combine multiple criteria (name + city)
4. **Fuzzy search:** Levenshtein distance for typo tolerance
5. **Search highlighting:** Return matched portion in results

---

## Token Usage

- **Consumed:** ~68,251 tokens (~6.8% of budget)
- **Remaining:** ~931,749 tokens

---

## Execution Time

- **Analysis & Planning:** ~2 minutes
- **Implementation:** ~3 minutes  
- **Testing & Debugging:** ~3 minutes
- **Total:** ~8 minutes

---

## Success Criteria ✅

- [x] Query parameter changed from `lastName` to `name`
- [x] Search works on both firstName and lastName
- [x] Contains matching implemented (not just starts-with)
- [x] Case-insensitive search working
- [x] All existing tests still pass
- [x] New tests added for edge cases
- [x] No compilation errors or warnings
- [x] Build successful

---

## Lessons Learned

1. **Test-First Mindset:** Writing comprehensive tests revealed edge cases early
2. **JPQL Optimization:** Using JOIN FETCH prevents N+1 queries
3. **String Handling:** Empty string check important (`name != null && !name.isEmpty()`)
4. **Test Data:** Choosing names with common substrings ("ann") validated OR logic effectively

---

## References

- Spring Data JPA Query Methods: https://docs.spring.io/spring-data/jpa/docs/current/reference/html/#jpa.query-methods
- JPQL Specification: https://jakarta.ee/specifications/persistence/3.0/jakarta-persistence-spec-3.0.html
- AssertJ Assertions: https://assertj.github.io/doc/

