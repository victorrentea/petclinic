# Owner Search Improvement (BE + FE) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement owner search that matches any visible Owners table column with case-insensitive contains semantics, while keeping existing `lastName` behavior compatible.

**Architecture:** Extend backend owners list endpoint with optional `q` broad-search parameter and route non-empty frontend search input to that parameter. Keep `lastName` prefix search path intact for compatibility. Verify behavior through focused backend and frontend tests.

**Tech Stack:** Spring Boot 3.5 (Java 21), Spring Data JPA, Angular 16, RxJS, Jasmine/Karma, JUnit 5 + MockMvc.

## Global Constraints

- Search columns must include owner full name, address, city, telephone, and pet names.
- Matching must be case-insensitive with contains semantics.
- Existing `lastName` query parameter must continue to work.
- Non-empty frontend input must use the new broad-search behavior.

---

### Task 1: Add backend failing tests for `q` search semantics

**Files:**
- Modify: `petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerTest.java`

**Interfaces:**
- Consumes: `GET /api/owners?q=<term>` from `OwnerRestController`.
- Produces: Failing tests that assert:
  - broad search over owner/pet fields
  - case-insensitive contains matching
  - existing `lastName` flow remains valid

- [ ] **Step 1: Write failing tests in `OwnerTest`**

```java
@Test
void getAllWithGeneralSearch_matchesOwnerFields_caseInsensitiveContains() throws Exception {
    Owner owner2 = TestData.anOwner();
    owner2.setFirstName("Alice");
    owner2.setLastName("Zimmer");
    owner2.setAddress("42 Maple Street");
    owner2.setCity("Bucharest");
    owner2.setTelephone("5551234");
    int owner2Id = ownerRepository.save(owner2).getId();

    List<OwnerDto> byName = search("/api/owners?q=imm");
    List<OwnerDto> byAddress = search("/api/owners?q=map");
    List<OwnerDto> byCity = search("/api/owners?q=CHARE");
    List<OwnerDto> byPhone = search("/api/owners?q=512");

    assertThat(byName).extracting(OwnerDto::getId).contains(owner2Id);
    assertThat(byAddress).extracting(OwnerDto::getId).contains(owner2Id);
    assertThat(byCity).extracting(OwnerDto::getId).contains(owner2Id);
    assertThat(byPhone).extracting(OwnerDto::getId).contains(owner2Id);
}

@Test
void getAllWithGeneralSearch_matchesPetName_caseInsensitiveContains() throws Exception {
    List<OwnerDto> owners = search("/api/owners?q=osy");
    assertThat(owners).extracting(OwnerDto::getId).contains(ownerId);
}
```

- [ ] **Step 2: Run focused backend test class and verify failure**

Run: `cd petclinic-backend && mvn test -Dtest=OwnerTest`  
Expected: FAIL on new `q` tests because endpoint/repository do not yet support broad search.

- [ ] **Step 3: Commit red test state**

```bash
git add petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerTest.java
git commit -m "test: define owner broad-search expectations"
```

### Task 2: Implement backend `q` search and make backend tests pass

**Files:**
- Modify: `petclinic-backend/src/main/java/victor/training/petclinic/repository/OwnerRepository.java`
- Modify: `petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java`
- Test: `petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerTest.java`

**Interfaces:**
- Consumes: `OwnerRepository` existing `findByLastNameStartingWith(String lastName)`.
- Produces:
  - `List<Owner> searchByQuery(String query)` in `OwnerRepository`
  - `listOwners(String lastName, String q)` behavior in `OwnerRestController`

- [ ] **Step 1: Add repository method for broad search**

```java
@Query("""
    SELECT DISTINCT o
    FROM Owner o
    LEFT JOIN o.pets p
    WHERE LOWER(CONCAT(o.firstName, ' ', o.lastName)) LIKE LOWER(CONCAT('%', :query, '%'))
       OR LOWER(o.address) LIKE LOWER(CONCAT('%', :query, '%'))
       OR LOWER(o.city) LIKE LOWER(CONCAT('%', :query, '%'))
       OR LOWER(o.telephone) LIKE LOWER(CONCAT('%', :query, '%'))
       OR LOWER(p.name) LIKE LOWER(CONCAT('%', :query, '%'))
    """)
List<Owner> searchByQuery(String query);
```

- [ ] **Step 2: Update controller list endpoint to use `q` when non-blank**

```java
public List<OwnerDto> listOwners(
        @RequestParam(name = "lastName", defaultValue = "") String lastName,
        @RequestParam(name = "q", required = false) String q) {
    List<Owner> owners = (q != null && !q.isBlank())
            ? ownerRepository.searchByQuery(q)
            : ownerRepository.findByLastNameStartingWith(lastName);
    return ownerMapper.toOwnerDtoCollection(owners);
}
```

- [ ] **Step 3: Run focused backend test class and verify pass**

Run: `cd petclinic-backend && mvn test -Dtest=OwnerTest`  
Expected: PASS including new `q` search tests and existing `lastName` tests.

- [ ] **Step 4: Commit backend implementation**

```bash
git add petclinic-backend/src/main/java/victor/training/petclinic/repository/OwnerRepository.java \
        petclinic-backend/src/main/java/victor/training/petclinic/rest/OwnerRestController.java \
        petclinic-backend/src/test/java/victor/training/petclinic/rest/OwnerTest.java
git commit -m "feat: add broad owner search query parameter"
```

### Task 3: Add frontend failing tests for broad search routing

**Files:**
- Modify: `petclinic-frontend/src/app/owners/owner.service.spec.ts`
- Modify: `petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts`

**Interfaces:**
- Consumes: `OwnerService` API surface from `owner.service.ts`.
- Produces: Failing tests expecting:
  - dedicated broad search method sends `?q=...`
  - owner list component calls broad search method for non-empty input

- [ ] **Step 1: Add service test for broad search URL**

```typescript
it('search owners by broad query', () => {
  ownerService.searchOwnersByQuery('fran').subscribe((owners) => {
    expect(owners).toEqual(expectedOwners);
  });

  const req = httpTestingController.expectOne(ownerService.entityUrl + '?q=fran');
  expect(req.request.method).toEqual('GET');
  req.flush(expectedOwners);
});
```

- [ ] **Step 2: Add component test for non-empty input path**

```typescript
it('searchByLastName should call searchOwnersByQuery for non-empty term', () => {
  const searchOwnersByQuerySpy = spyOn(ownerService, 'searchOwnersByQuery').and.returnValue(of(testOwners));

  component.searchByLastName('Fr');

  expect(searchOwnersByQuerySpy).toHaveBeenCalledWith('Fr');
});
```

- [ ] **Step 3: Run focused frontend specs and verify failure**

Run:  
`cd petclinic-frontend && npm test -- --watch=false --browsers=ChromeHeadless --include=src/app/owners/owner.service.spec.ts --include=src/app/owners/owner-list/owner-list.component.spec.ts`  
Expected: FAIL because broad search method is not implemented yet.

- [ ] **Step 4: Commit red frontend tests**

```bash
git add petclinic-frontend/src/app/owners/owner.service.spec.ts \
        petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts
git commit -m "test: define frontend broad owner search behavior"
```

### Task 4: Implement frontend broad search behavior and pass frontend tests

**Files:**
- Modify: `petclinic-frontend/src/app/owners/owner.service.ts`
- Modify: `petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts`
- Modify: `petclinic-frontend/src/app/owners/owner-list/owner-list.component.html`
- Test: `petclinic-frontend/src/app/owners/owner.service.spec.ts`
- Test: `petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts`

**Interfaces:**
- Consumes: backend `GET /api/owners?q=<text>`.
- Produces:
  - `searchOwnersByQuery(query: string): Observable<Owner[]>` in `OwnerService`
  - component search flow using `searchOwnersByQuery` when input is non-empty

- [ ] **Step 1: Add broad search method to `OwnerService`**

```typescript
searchOwnersByQuery(query: string): Observable<Owner[]> {
  const url = `${this.entityUrl}?q=${query}`;
  return this.http
    .get<Owner[]>(url)
    .pipe(catchError(this.handlerError('searchOwnersByQuery', [])));
}
```

- [ ] **Step 2: Update component search dispatch to use broad search method**

```typescript
if (lastName !== '') {
  this.ownerService.searchOwnersByQuery(lastName).subscribe(
    (owners) => { this.owners = owners; },
    () => { this.owners = null; }
  );
}
```

- [ ] **Step 3: Update empty-state copy in template**

```html
<div *ngIf="!owners">No owners matched "{{lastName}}"</div>
```

- [ ] **Step 4: Run focused frontend specs and verify pass**

Run:  
`cd petclinic-frontend && npm test -- --watch=false --browsers=ChromeHeadless --include=src/app/owners/owner.service.spec.ts --include=src/app/owners/owner-list/owner-list.component.spec.ts`  
Expected: PASS.

- [ ] **Step 5: Run focused backend and frontend regression checks**

Run:
- `cd petclinic-backend && mvn test -Dtest=OwnerTest`
- `cd petclinic-frontend && npm test -- --watch=false --browsers=ChromeHeadless --include=src/app/owners/owner-list/owner-list.component.spec.ts`

Expected: PASS for all commands.

- [ ] **Step 6: Commit frontend implementation**

```bash
git add petclinic-frontend/src/app/owners/owner.service.ts \
        petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts \
        petclinic-frontend/src/app/owners/owner-list/owner-list.component.html \
        petclinic-frontend/src/app/owners/owner.service.spec.ts \
        petclinic-frontend/src/app/owners/owner-list/owner-list.component.spec.ts
git commit -m "feat: use broad owner search across visible columns"
```
