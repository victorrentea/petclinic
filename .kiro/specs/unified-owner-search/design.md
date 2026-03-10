# Design: Unified Owner Search

## High-Level Design

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Angular)                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  owner-list.component.html                             │ │
│  │  - Single search input field                           │ │
│  │  - Placeholder: "Search by name, address, or city"     │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  owner-list.component.ts                               │ │
│  │  - searchText: string (replaces name & address)        │ │
│  │  - Calls ownerService.getOwners({search: searchText})  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP GET /api/owners?search={text}
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Spring Boot)                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  OwnerRestController                                   │ │
│  │  - listOwners(@RequestParam search)                    │ │
│  │  - Calls ownerRepository.findBySearch(search)          │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  OwnerRepository                                       │ │
│  │  - findBySearch(String search, Pageable)              │ │
│  │  - JPQL query with OR conditions                       │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ SQL Query
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Database                               │
│  SELECT * FROM owner WHERE                                   │
│    UPPER(first_name) LIKE UPPER('%search%') OR              │
│    UPPER(last_name) LIKE UPPER('%search%') OR               │
│    UPPER(address) LIKE UPPER('%search%') OR                 │
│    UPPER(city) LIKE UPPER('%search%')                       │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. User types in unified search field
2. Frontend debounces input (300ms) and sends request to backend
3. Backend receives single `search` parameter
4. Repository executes JPQL query with OR conditions across name, address, and city
5. Results returned to frontend and displayed in grid

## Low-Level Design

### Frontend Changes

#### owner-list.component.html
```html
<!-- BEFORE: Two separate fields -->
<div class="form-group" id="nameGroup">
  <label for="name">Name</label>
  <input id="name" [(ngModel)]="name" ... />
</div>
<div class="form-group" id="addressGroup">
  <label for="address">Address</label>
  <input id="address" [(ngModel)]="address" ... />
</div>

<!-- AFTER: Single unified field -->
<div class="form-group" id="searchGroup">
  <label for="search">Search</label>
  <input id="search" 
         placeholder="Search by name, address, or city"
         [(ngModel)]="searchText" 
         (input)="queueSearch()" 
         (blur)="searchOnBlur()"
         (keyup.enter)="searchOnEnter()" />
</div>
```

#### owner-list.component.ts
```typescript
export class OwnerListComponent implements OnInit {
  // REMOVE: name: string; address: string;
  // ADD:
  searchText: string;

  private loadOwners() {
    const normalizedSearch = this.normalizeSearchTerm(this.searchText || '');
    const sortParams = this.buildSortParams();

    this.ownerService.getOwners({
      search: normalizedSearch,  // Changed from name/address to search
      page: this.pageIndex,
      size: this.pageSize,
      sort: sortParams
    }).pipe(
      finalize(() => {
        this.isOwnersDataReceived = true;
      })
    ).subscribe(
      (page) => {
        this.owners = page.content;
        this.totalElements = page.totalElements;
        this.totalPages = page.totalPages;
      },
      () => {
        this.owners = null;
      }
    );
  }
}
```

#### owner.service.ts
```typescript
getOwners(params: {
  search?: string;  // Changed from name/address
  page?: number;
  size?: number;
  sort?: string[];
}): Observable<OwnerPage> {
  let httpParams = new HttpParams();
  
  if (params.search) {
    httpParams = httpParams.set('search', params.search);
  }
  // ... rest of params
  
  return this.http.get<OwnerPage>('/api/owners', { params: httpParams });
}
```

### Backend Changes

#### OwnerRestController.java
```java
@GetMapping(produces = "application/json")
public Page<OwnerDto> listOwners(
    @RequestParam(required = false) String search,  // Changed from name/address
    @PageableDefault(size = 10, sort = {"lastName", "firstName", "address", "city"}) Pageable pageable
) {
    String trimmedSearch = normalizeSearchTerm(search);
    
    return ownerRepository.findBySearch(trimmedSearch, pageable)
        .map(ownerMapper::toOwnerDto);
}
```

#### OwnerRepository.java
```java
@Query("""
    SELECT owner FROM Owner owner
    WHERE :search IS NULL OR :search = ''
        OR UPPER(owner.firstName) LIKE UPPER(CONCAT('%', :search, '%'))
        OR UPPER(owner.lastName) LIKE UPPER(CONCAT('%', :search, '%'))
        OR UPPER(owner.address) LIKE UPPER(CONCAT('%', :search, '%'))
        OR UPPER(owner.city) LIKE UPPER(CONCAT('%', :search, '%'))
    """)
Page<Owner> findBySearch(String search, Pageable pageable);
```

### Algorithm: Search Query Construction

**Input:** `search` - user's search text (String)

**Output:** Page of Owner entities matching the search criteria

**Steps:**
1. Normalize search term (trim whitespace)
2. If search is null or empty, return all owners (paginated)
3. Convert search term to uppercase for case-insensitive comparison
4. Execute query that checks if search term is substring of:
   - firstName (case-insensitive)
   - lastName (case-insensitive)
   - address (case-insensitive)
   - city (case-insensitive)
5. Use OR logic - owner matches if ANY field contains the search term
6. Return distinct owners (no duplicates)
7. Apply pagination and sorting

**Complexity:**
- Time: O(n) where n = number of owners (database scan with LIKE)
- Space: O(m) where m = page size (result set)

### Database Considerations

**Current Schema:**
```sql
CREATE TABLE owner (
  id INTEGER PRIMARY KEY,
  first_name VARCHAR(30),
  last_name VARCHAR(30),
  address VARCHAR(255),
  city VARCHAR(80),
  telephone VARCHAR(20)
);
```

**Index Recommendations:**
For optimal performance with LIKE queries on large datasets, consider adding:
```sql
-- Composite index for common search patterns
CREATE INDEX idx_owner_search ON owner (last_name, first_name, city, address);
```

Note: LIKE with leading wildcard (`%search%`) cannot use indexes efficiently. For very large datasets (>100k owners), consider full-text search solutions.

## Property-Based Testing Strategy

### Test 1: Search Completeness Property
```typescript
// Property: If search term is substring of any owner field, owner must be in results
property('search returns all matching owners', 
  fc.record({
    owners: fc.array(fc.record({
      firstName: fc.string(),
      lastName: fc.string(),
      address: fc.string(),
      city: fc.string()
    })),
    searchTerm: fc.string()
  }),
  ({owners, searchTerm}) => {
    // Setup: Insert owners into test database
    const inserted = insertOwners(owners);
    
    // Execute: Search
    const results = searchOwners(searchTerm);
    
    // Verify: All owners containing searchTerm are in results
    const expected = inserted.filter(o => 
      containsIgnoreCase(o.firstName, searchTerm) ||
      containsIgnoreCase(o.lastName, searchTerm) ||
      containsIgnoreCase(o.address, searchTerm) ||
      containsIgnoreCase(o.city, searchTerm)
    );
    
    return expected.every(e => results.some(r => r.id === e.id));
  }
);
```

### Test 2: Search Precision Property
```typescript
// Property: All returned owners must match the search term
property('search returns only matching owners',
  fc.record({
    owners: fc.array(fc.record({
      firstName: fc.string(),
      lastName: fc.string(),
      address: fc.string(),
      city: fc.string()
    })),
    searchTerm: fc.string().filter(s => s.length > 0)
  }),
  ({owners, searchTerm}) => {
    const inserted = insertOwners(owners);
    const results = searchOwners(searchTerm);
    
    // Verify: Every result matches search term in at least one field
    return results.every(r => 
      containsIgnoreCase(r.firstName, searchTerm) ||
      containsIgnoreCase(r.lastName, searchTerm) ||
      containsIgnoreCase(r.address, searchTerm) ||
      containsIgnoreCase(r.city, searchTerm)
    );
  }
);
```

### Test 3: No Duplicates Property
```typescript
// Property: Each owner appears at most once in results
property('search returns no duplicate owners',
  fc.record({
    owners: fc.array(fc.record({
      firstName: fc.string(),
      lastName: fc.string(),
      address: fc.string(),
      city: fc.string()
    })),
    searchTerm: fc.string()
  }),
  ({owners, searchTerm}) => {
    const inserted = insertOwners(owners);
    const results = searchOwners(searchTerm);
    
    // Verify: No duplicate IDs
    const ids = results.map(r => r.id);
    const uniqueIds = new Set(ids);
    return ids.length === uniqueIds.size;
  }
);
```

### Test 4: Case Insensitivity Property
```typescript
// Property: Search is case-insensitive
property('search is case insensitive',
  fc.record({
    owners: fc.array(fc.record({
      firstName: fc.string(),
      lastName: fc.string(),
      address: fc.string(),
      city: fc.string()
    })),
    searchTerm: fc.string().filter(s => s.length > 0)
  }),
  ({owners, searchTerm}) => {
    const inserted = insertOwners(owners);
    
    const resultsLower = searchOwners(searchTerm.toLowerCase());
    const resultsUpper = searchOwners(searchTerm.toUpperCase());
    const resultsOriginal = searchOwners(searchTerm);
    
    // Verify: All three searches return same results
    return sameResults(resultsLower, resultsUpper) &&
           sameResults(resultsUpper, resultsOriginal);
  }
);
```

## Migration Strategy

### Backward Compatibility

**Option 1: Deprecation Period (Recommended)**
- Keep both old API (`name`, `address` params) and new API (`search` param)
- If `search` is provided, use new logic
- If `name` or `address` provided, use old logic
- Log deprecation warnings for old params
- Remove old params in next major version

**Option 2: Immediate Migration**
- Replace old params with new param immediately
- Update all clients simultaneously
- Higher risk but simpler codebase

**Recommendation:** Use Option 1 for safer rollout.

### Implementation Approach

**Phase 1: Backend**
1. Add new `findBySearch` method to repository
2. Update controller to accept `search` parameter
3. Keep old parameters for backward compatibility
4. Add integration tests

**Phase 2: Frontend**
1. Update component template (single search field)
2. Update component TypeScript (single searchText property)
3. Update service to send `search` parameter
4. Add unit tests

**Phase 3: Testing**
1. Run property-based tests
2. Manual testing of search functionality
3. Performance testing with large datasets

**Phase 4: Cleanup (Future)**
1. Remove deprecated `name` and `address` parameters
2. Remove old repository method
3. Update API documentation

## Error Handling

### Frontend
- Empty search: Show all owners (existing behavior)
- Network error: Display error message to user
- No results: Show "No owners found" message

### Backend
- Null/empty search: Return all owners (paginated)
- Invalid pagination params: Use defaults
- Database error: Return 500 with error message

## Performance Considerations

### Current Performance
- Database: LIKE queries with wildcards are not index-optimized
- Expected: O(n) scan of owner table
- Acceptable for small-medium datasets (<10k owners)

### Optimization Opportunities (Future)
1. Full-text search index (PostgreSQL: `tsvector`, MySQL: `FULLTEXT`)
2. Elasticsearch integration for large datasets
3. Caching frequently searched terms
4. Query result pagination optimization

### Load Testing Targets
- Response time: <500ms for 10k owners
- Concurrent users: 100 simultaneous searches
- Database load: Monitor query execution time
