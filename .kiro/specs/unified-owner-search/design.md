# Design: Unified Owner Search

## High-Level Design

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Angular)                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  owner-list.component.html                             │ │
│  │  - Single search input field                           │ │
│  │  - Placeholder: "Search by name, address, city,        │ │
│  │    telephone, or pet name"                             │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  owner-list.component.ts                               │ │
│  │  - searchText: string                                  │ │
│  │  - Calls ownerService.getOwners(searchText)            │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP GET /api/owners?q={text}
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Spring Boot)                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  OwnerRestController                                   │ │
│  │  - listOwners(@RequestParam q)                         │ │
│  │  - Calls ownerRepository.findBySearch(q)               │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  OwnerRepository                                       │ │
│  │  - findBySearch(String q, Pageable)                    │ │
│  │  - JPQL query with EXISTS for pet names                │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ SQL Query
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Database                               │
│  SELECT o.* FROM owners o                                   │
│  WHERE                                                       │
│    UPPER(o.first_name) LIKE UPPER('%term%') OR              │
│    UPPER(o.last_name)  LIKE UPPER('%term%') OR              │
│    UPPER(o.address)    LIKE UPPER('%term%') OR              │
│    UPPER(o.city)       LIKE UPPER('%term%') OR              │
│    UPPER(o.telephone)  LIKE UPPER('%term%') OR              │
│    EXISTS (                                                  │
│      SELECT 1 FROM pets p WHERE p.owner_id = o.id           │
│        AND UPPER(p.name) LIKE UPPER('%term%')               │
│    )                                                         │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. User types in unified search field
2. Frontend debounces input (400ms) and sends request to backend
3. Backend receives single `q` parameter
4. Repository executes JPQL query with EXISTS subquery for pet name matching, avoiding cardinality explosion
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
  <input id="search"
         placeholder="Search by name, address, city, telephone, or pet name"
         maxlength="255"
         [(ngModel)]="searchText"
         (input)="onSearchInput($event.target.value)" />
</div>
```

#### owner-list.component.ts
```typescript
export class OwnerListComponent implements OnInit {
  searchText: string = '';
  isLoading: boolean = false;
  owners: Owner[] = [];

  private searchSubject = new Subject<string>();
  private destroyRef = inject(DestroyRef);  // Angular 16+

  ngOnInit(): void {
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      tap(() => this.isLoading = true),
      switchMap(term => this.ownerService.getOwners(term || undefined)),
      finalize(() => this.isLoading = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: owners => {
        this.owners = owners;
      },
      error: () => {
        this.owners = [];
      }
    });

    // Load all owners on init
    this.searchSubject.next('');
  }

  onSearchInput(value: string): void {
    this.searchSubject.next(value);
  }
}
```

#### owner.service.ts
```typescript
getOwners(q?: string): Observable<Owner[]> {
  let httpParams = new HttpParams();
  if (q) {
    httpParams = httpParams.set('q', q);
  }
  return this.http.get<Owner[]>('/api/owners', { params: httpParams });
}
```

### Backend Changes

#### OwnerRestController.java
```java
@GetMapping(produces = "application/json")
public Page<OwnerDto> listOwners(
    @RequestParam(required = false) String q,
    @PageableDefault(size = 10, sort = {"firstName", "lastName"}, direction = Sort.Direction.ASC) Pageable pageable
) {
    String normalized = normalizeSearchTerm(q);
    
    return ownerRepository.findBySearch(normalized, pageable)
        .map(ownerMapper::toOwnerDto);
}

private String normalizeSearchTerm(String term) {
    if (term == null) return null;
    String trimmed = term.trim();
    return trimmed.isEmpty() ? null : trimmed;
}
```

#### OwnerRepository.java
```java
@Query("""
    SELECT owner FROM Owner owner
    WHERE :q IS NULL OR :q = ''
        OR UPPER(owner.firstName) LIKE UPPER(CONCAT('%', :q, '%'))
        OR UPPER(owner.lastName)  LIKE UPPER(CONCAT('%', :q, '%'))
        OR UPPER(owner.address)   LIKE UPPER(CONCAT('%', :q, '%'))
        OR UPPER(owner.city)      LIKE UPPER(CONCAT('%', :q, '%'))
        OR UPPER(owner.telephone) LIKE UPPER(CONCAT('%', :q, '%'))
        OR EXISTS (
            SELECT 1 FROM Pet pet
            WHERE pet.owner = owner
              AND UPPER(pet.name) LIKE UPPER(CONCAT('%', :q, '%'))
        )
    """)
Page<Owner> findBySearch(@Param("q") String q, Pageable pageable);
```

### Algorithm: Search Query Construction

**Input:** `q` - user's search text (String)

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
   - telephone (case-insensitive)
   - any of the owner's pet names (case-insensitive, via EXISTS subquery)
5. Use OR logic - owner matches if ANY field (including any pet name) contains the search term
6. No DISTINCT needed — EXISTS returns each owner at most once regardless of how many pets match
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
// Property: If search term is substring of any owner field or pet name, owner must be in results
property('search returns all matching owners', 
  fc.record({
    owners: fc.array(fc.record({
      firstName: fc.string(),
      lastName: fc.string(),
      address: fc.string(),
      city: fc.string(),
      telephone: fc.string(),
      pets: fc.array(fc.record({ name: fc.string() }))
    })),
    searchTerm: fc.string()
  }),
  ({owners, searchTerm}) => {
    const inserted = insertOwners(owners);
    const results = searchOwners(searchTerm);
    
    const expected = inserted.filter(o => 
      containsIgnoreCase(o.firstName, searchTerm) ||
      containsIgnoreCase(o.lastName, searchTerm) ||
      containsIgnoreCase(o.address, searchTerm) ||
      containsIgnoreCase(o.city, searchTerm) ||
      containsIgnoreCase(o.telephone, searchTerm) ||
      o.pets.some(p => containsIgnoreCase(p.name, searchTerm))
    );
    
    return expected.every(e => results.some(r => r.id === e.id));
  }
);
```

### Test 2: Search Precision Property
```typescript
// Property: All returned owners must match the search term in at least one field or pet name
property('search returns only matching owners',
  fc.record({
    owners: fc.array(fc.record({
      firstName: fc.string(),
      lastName: fc.string(),
      address: fc.string(),
      city: fc.string(),
      telephone: fc.string(),
      pets: fc.array(fc.record({ name: fc.string() }))
    })),
    searchTerm: fc.string().filter(s => s.length > 0)
  }),
  ({owners, searchTerm}) => {
    const inserted = insertOwners(owners);
    const results = searchOwners(searchTerm);
    
    return results.every(r => 
      containsIgnoreCase(r.firstName, searchTerm) ||
      containsIgnoreCase(r.lastName, searchTerm) ||
      containsIgnoreCase(r.address, searchTerm) ||
      containsIgnoreCase(r.city, searchTerm) ||
      containsIgnoreCase(r.telephone, searchTerm) ||
      r.pets.some(p => containsIgnoreCase(p.name, searchTerm))
    );
  }
);
```

### Test 3: No Duplicates Property
```typescript
// Property: Each owner appears at most once in results, even if multiple pets match
property('search returns no duplicate owners',
  fc.record({
    owners: fc.array(fc.record({
      firstName: fc.string(),
      lastName: fc.string(),
      address: fc.string(),
      city: fc.string(),
      telephone: fc.string(),
      pets: fc.array(fc.record({ name: fc.string() }))
    })),
    searchTerm: fc.string()
  }),
  ({owners, searchTerm}) => {
    const inserted = insertOwners(owners);
    const results = searchOwners(searchTerm);
    
    const ids = results.map(r => r.id);
    return ids.length === new Set(ids).size;
  }
);
```

### Test 4: Case Insensitivity Property
```typescript
// Property: Search is case-insensitive across all fields including pet names
property('search is case insensitive',
  fc.record({
    owners: fc.array(fc.record({
      firstName: fc.string(),
      lastName: fc.string(),
      address: fc.string(),
      city: fc.string(),
      telephone: fc.string(),
      pets: fc.array(fc.record({ name: fc.string() }))
    })),
    searchTerm: fc.string().filter(s => s.length > 0)
  }),
  ({owners, searchTerm}) => {
    const inserted = insertOwners(owners);
    
    const resultsLower    = searchOwners(searchTerm.toLowerCase());
    const resultsUpper    = searchOwners(searchTerm.toUpperCase());
    const resultsOriginal = searchOwners(searchTerm);
    
    return sameResults(resultsLower, resultsUpper) &&
           sameResults(resultsUpper, resultsOriginal);
  }
);
```

## Migration Strategy

### Backward Compatibility

The implementation uses **immediate migration** — the `?q=` parameter replaces the old `lastName` filter. No deprecation period. The endpoint remains `GET /api/owners`, maintaining backward compatibility for clients that don't provide any query parameter (they get all owners).

### Implementation Approach

**Phase 1: Backend**
1. Add new `findBySearch` method to repository with EXISTS subquery for pet names
2. Update controller to accept `q` parameter and remove old `lastName` parameter
3. Add integration tests

**Phase 2: Frontend**
1. Update component template (single search field)
2. Update component TypeScript (single searchText property)
3. Update service to send `q` parameter
4. Add unit tests

**Phase 3: Testing**
1. Run property-based tests
2. Manual testing of search functionality
3. Performance testing with large datasets (Gatling simulation)

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
