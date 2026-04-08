# Owner List Sorting & Pagination — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-side pagination (10/20/50 per page), sortable Name and City columns, and diacritic-insensitive `q` search to the owner list, safe for 100k+ owners in production.

**Architecture:** OwnerRepository gets a custom JPQL query using a correlated EXISTS subquery for pet name search and `FUNCTION('unaccent', ...)` for diacritic normalization in both H2 and PostgreSQL. Controller maps logical `sort=name` to `firstName, lastName` fields and returns Spring's `Page<OwnerDto>`. Angular owner-list gains sortable headers, a page size selector, and a paginator.

**Tech Stack:** Spring Boot 3, Spring Data JPA / Hibernate 6, H2 (test), PostgreSQL (prod), Angular 16, Bootstrap 3. All Lombok setters are chainable (`lombok.accessors.chain=true`).

---

## Files

| Action | Path |
|--------|------|
| Modify | `petclinic-backend/src/main/resources/db/h2/schema.sql` |
| Modify | `petclinic-backend/src/main/resources/db/postgres/schema.sql` |
| Create | `petclinic-backend/src/main/java/org/springframework/samples/petclinic/util/StringNormalizer.java` |
| Modify | `petclinic-backend/src/main/java/org/springframework/samples/petclinic/model/Owner.java` |
| Modify | `petclinic-backend/src/main/java/org/springframework/samples/petclinic/repository/OwnerRepository.java` |
| Create | `petclinic-backend/src/main/java/org/springframework/samples/petclinic/config/WebConfig.java` |
| Modify | `petclinic-backend/src/main/java/org/springframework/samples/petclinic/rest/OwnerRestController.java` |
| Create | `petclinic-backend/src/test/java/org/springframework/samples/petclinic/repository/OwnerRepositoryTest.java` |
| Modify | `petclinic-backend/src/test/java/org/springframework/samples/petclinic/rest/OwnerTest.java` |
| Modify | `openapi.yaml` (project root) — regenerated, not hand-edited |
| Exists | `petclinic-frontend/src/app/owners/owner-page.ts` — already correct, no change |
| Modify | `petclinic-frontend/src/app/owners/owner.service.ts` |
| Modify | `petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts` |
| Modify | `petclinic-frontend/src/app/owners/owner-list/owner-list.component.html` |

---

## Task 1: Register UNACCENT function in H2 and PostgreSQL

No test needed — this is infrastructure that later tests depend on.

**Files:**
- Modify: `petclinic-backend/src/main/resources/db/h2/schema.sql`
- Modify: `petclinic-backend/src/main/resources/db/postgres/schema.sql`
- Create: `petclinic-backend/src/main/java/org/springframework/samples/petclinic/util/StringNormalizer.java`

- [ ] **Step 1: Create StringNormalizer utility class**

```java
package org.springframework.samples.petclinic.util;

import java.text.Normalizer;

public class StringNormalizer {
    /** Called by H2 via CREATE ALIAS UNACCENT */
    public static String unaccent(String input) {
        if (input == null) return null;
        return Normalizer.normalize(input, Normalizer.Form.NFD)
            .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
    }
}
```

- [ ] **Step 2: Register UNACCENT alias in H2 schema**

In `petclinic-backend/src/main/resources/db/h2/schema.sql`, add at the very top (before any CREATE TABLE):

```sql
CREATE ALIAS IF NOT EXISTS UNACCENT FOR "org.springframework.samples.petclinic.util.StringNormalizer.unaccent";
```

- [ ] **Step 3: Enable unaccent extension in PostgreSQL schema**

In `petclinic-backend/src/main/resources/db/postgres/schema.sql`, add at the very top:

```sql
CREATE EXTENSION IF NOT EXISTS unaccent;
```

- [ ] **Step 4: Commit**

```bash
git add petclinic-backend/src/main/resources/db/h2/schema.sql \
        petclinic-backend/src/main/resources/db/postgres/schema.sql \
        petclinic-backend/src/main/java/org/springframework/samples/petclinic/util/StringNormalizer.java
git commit -m "feat: register UNACCENT function in H2 and PostgreSQL"
```

---

## Task 2: Add indexes to Owner entity

**Files:**
- Modify: `petclinic-backend/src/main/java/org/springframework/samples/petclinic/model/Owner.java`

- [ ] **Step 1: Write a failing test that the app starts and indexes exist**

This is implicitly tested by every `@SpringBootTest` test — Hibernate DDL runs at context start. No dedicated test needed; proceed to implementation.

- [ ] **Step 2: Replace `@Table(name = "owners")` annotation on Owner**

Current:
```java
@Table(name = "owners")
```

Replace with:
```java
@Table(name = "owners", indexes = {
    @Index(name = "idx_owner_name", columnList = "first_name, last_name"),
    @Index(name = "idx_owner_city", columnList = "city")
})
```

Add the import:
```java
import jakarta.persistence.Index;
```

- [ ] **Step 3: Commit**

```bash
git add petclinic-backend/src/main/java/org/springframework/samples/petclinic/model/Owner.java
git commit -m "feat: add indexes on owner name and city for sort performance"
```

---

## Task 3: TDD — OwnerRepository.findByQuery

**Files:**
- Modify: `petclinic-backend/src/main/java/org/springframework/samples/petclinic/repository/OwnerRepository.java`
- Create: `petclinic-backend/src/test/java/org/springframework/samples/petclinic/repository/OwnerRepositoryTest.java`

- [ ] **Step 1: Write failing tests**

Create `OwnerRepositoryTest.java`:

```java
package org.springframework.samples.petclinic.repository;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.samples.petclinic.model.Owner;
import org.springframework.samples.petclinic.model.Pet;
import org.springframework.samples.petclinic.model.PetType;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
class OwnerRepositoryTest {

    @Autowired OwnerRepository ownerRepository;
    @Autowired PetRepository petRepository;
    @Autowired PetTypeRepository petTypeRepository;

    private Owner savedOwner(String firstName, String lastName) {
        return ownerRepository.save(new Owner()
            .setFirstName(firstName)
            .setLastName(lastName)
            .setAddress("123 Main St")
            .setCity("Springfield")
            .setTelephone("1234567890"));
    }

    @Test
    void findByQuery_blankFilter_returnsPaginatedResults() {
        for (int i = 0; i < 12; i++) {
            savedOwner("First" + i, "Last" + i);
        }

        Page<Owner> page = ownerRepository.findByQuery("", PageRequest.of(0, 10));

        assertThat(page.getContent()).hasSize(10);
        assertThat(page.getTotalElements()).isGreaterThanOrEqualTo(12);
        assertThat(page.getTotalPages()).isGreaterThanOrEqualTo(2);
    }

    @Test
    void findByQuery_filterByLastName_returnsOnlyMatching() {
        savedOwner("Betty", "Davis");
        savedOwner("George", "Franklin");

        Page<Owner> page = ownerRepository.findByQuery("%Davis%", PageRequest.of(0, 10));

        assertThat(page.getContent())
            .extracting(Owner::getLastName)
            .containsOnly("Davis");
    }

    @Test
    void findByQuery_diacriticSearch_matchesStoredAccentedName() {
        savedOwner("Müller", "Hans");

        Page<Owner> page = ownerRepository.findByQuery("%Muller%", PageRequest.of(0, 10));

        assertThat(page.getContent())
            .extracting(Owner::getFirstName)
            .contains("Müller");
    }

    @Test
    void findByQuery_searchByPetName_returnsOwner() {
        Owner owner = savedOwner("John", "Smith");
        PetType type = petTypeRepository.save(new PetType().setName("cat"));
        petRepository.save(new Pet()
            .setName("Whiskers")
            .setBirthDate(LocalDate.now())
            .setOwner(owner)
            .setType(type));

        Page<Owner> page = ownerRepository.findByQuery("%Whiskers%", PageRequest.of(0, 10));

        assertThat(page.getContent())
            .extracting(Owner::getLastName)
            .contains("Smith");
    }

    @Test
    void findByQuery_ownerWithMultiplePets_noDuplicates() {
        Owner owner = savedOwner("Jane", "Doe");
        PetType type = petTypeRepository.save(new PetType().setName("dog"));
        petRepository.save(new Pet().setName("Fluffy").setBirthDate(LocalDate.now()).setOwner(owner).setType(type));
        petRepository.save(new Pet().setName("Fluffball").setBirthDate(LocalDate.now()).setOwner(owner).setType(type));

        Page<Owner> page = ownerRepository.findByQuery("%Fluff%", PageRequest.of(0, 10));

        assertThat(page.getContent())
            .extracting(Owner::getId)
            .containsOnlyOnce(owner.getId());
    }

    @Test
    void findByQuery_sortByFirstName_returnsInOrder() {
        savedOwner("Zara", "Alpha");
        savedOwner("Anna", "Beta");

        Page<Owner> page = ownerRepository.findByQuery("",
            PageRequest.of(0, 10, Sort.by(Sort.Direction.ASC, "firstName")));

        var names = page.getContent().stream().map(Owner::getFirstName).toList();
        assertThat(names).isSortedAccordingTo(String::compareTo);
    }
}
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd petclinic-backend && ./mvnw test -Dtest=OwnerRepositoryTest -q 2>&1 | tail -20
```

Expected: compilation error (findByQuery not defined yet).

- [ ] **Step 3: Implement OwnerRepository**

Replace the entire file:

```java
package org.springframework.samples.petclinic.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.samples.petclinic.model.Owner;

import java.util.Optional;

public interface OwnerRepository extends JpaRepository<Owner, Integer> {

    @Query("""
        SELECT o FROM Owner o
        WHERE :q = ''
          OR LOWER(FUNCTION('unaccent', o.firstName)) LIKE LOWER(FUNCTION('unaccent', :q))
          OR LOWER(FUNCTION('unaccent', o.lastName))  LIKE LOWER(FUNCTION('unaccent', :q))
          OR LOWER(FUNCTION('unaccent', o.city))       LIKE LOWER(FUNCTION('unaccent', :q))
          OR LOWER(FUNCTION('unaccent', o.address))    LIKE LOWER(FUNCTION('unaccent', :q))
          OR o.telephone                               LIKE :q
          OR EXISTS (
               SELECT 1 FROM Pet p
               WHERE p.owner = o
               AND LOWER(FUNCTION('unaccent', p.name)) LIKE LOWER(FUNCTION('unaccent', :q))
             )
        """)
    Page<Owner> findByQuery(@Param("q") String q, Pageable pageable);
}
```

Note: the old methods `findByLastNameStartingWith`, `findAll()`, `delete()` are now inherited from `JpaRepository`. `findById(int id)` — `JpaRepository.findById` takes `Integer`, which autoboxes from int. Verify the controller compiles (it calls `findById(ownerId)` where ownerId is `int`).

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd petclinic-backend && ./mvnw test -Dtest=OwnerRepositoryTest -q 2>&1 | tail -20
```

Expected: `Tests run: 6, Failures: 0, Errors: 0`

- [ ] **Step 5: Commit**

```bash
git add petclinic-backend/src/main/java/org/springframework/samples/petclinic/repository/OwnerRepository.java \
        petclinic-backend/src/test/java/org/springframework/samples/petclinic/repository/OwnerRepositoryTest.java
git commit -m "feat: add paginated findByQuery to OwnerRepository with diacritic-insensitive search"
```

---

## Task 4: TDD — Page size cap (DoS protection)

**Files:**
- Create: `petclinic-backend/src/main/java/org/springframework/samples/petclinic/config/WebConfig.java`
- Modify: `petclinic-backend/src/test/java/org/springframework/samples/petclinic/rest/OwnerTest.java`

- [ ] **Step 1: Write a failing test for page size cap**

In `OwnerTest.java`, add this test at the end of the class:

```java
@Test
void listOwners_oversizedPage_isCappedAt50() throws Exception {
    // When requesting a huge page size
    String json = mockMvc.perform(get("/api/owners?size=3000000"))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString();

    JsonNode root = mapper.readTree(json);
    assertThat(root.get("size").asInt()).isLessThanOrEqualTo(50);
}
```

Add import at the top of OwnerTest:
```java
import com.fasterxml.jackson.databind.JsonNode;
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd petclinic-backend && ./mvnw test -Dtest=OwnerTest#listOwners_oversizedPage_isCappedAt50 -q 2>&1 | tail -20
```

Expected: FAIL — the endpoint returns a list (not a page object yet), and no size cap is applied.

- [ ] **Step 3: Create WebConfig with page size cap**

```java
package org.springframework.samples.petclinic.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.web.PageableHandlerMethodArgumentResolverCustomizer;

@Configuration
public class WebConfig {

    @Bean
    public PageableHandlerMethodArgumentResolverCustomizer pageableCustomizer() {
        return resolver -> resolver.setMaxPageSize(50);
    }
}
```

Note: this test will still fail until the controller is updated to return a Page. Leave it failing — it becomes green in Task 5.

- [ ] **Step 4: Commit**

```bash
git add petclinic-backend/src/main/java/org/springframework/samples/petclinic/config/WebConfig.java \
        petclinic-backend/src/test/java/org/springframework/samples/petclinic/rest/OwnerTest.java
git commit -m "feat: cap Pageable max page size at 50 to prevent DoS"
```

---

## Task 5: TDD — OwnerRestController: pagination, q search, sorting

**Files:**
- Modify: `petclinic-backend/src/main/java/org/springframework/samples/petclinic/rest/OwnerRestController.java`
- Modify: `petclinic-backend/src/test/java/org/springframework/samples/petclinic/rest/OwnerTest.java`

- [ ] **Step 1: Write failing tests in OwnerTest**

Replace the `search()` helper and add new tests. Find the existing `search()` helper method and `getAllWithNameFilter` test:

**Replace the `search()` helper** (currently returns `List<OwnerDto>`) with:

```java
private record OwnerPageResult(List<OwnerDto> content, long totalElements, int totalPages, int number, int size) {}

private OwnerPageResult searchPage(String uriTemplate) throws Exception {
    String responseJson = mockMvc.perform(get(uriTemplate))
        .andExpect(status().isOk())
        .andExpect(content().contentType("application/json"))
        .andReturn().getResponse().getContentAsString();
    return mapper.readValue(responseJson, OwnerPageResult.class);
}

private List<OwnerDto> search(String uriTemplate) throws Exception {
    return searchPage(uriTemplate).content();
}
```

**Update existing tests** that use `?lastName=` to use `?q=`:

- `getAllWithNameFilter`: change `"/api/owners?lastName=Dav"` → `"/api/owners?q=Dav"`
- `getAllWithAddressFilter`: change `"/api/owners?lastName=Java"` → `"/api/owners?q=Java"`
- `getAllWithNameFilter_notFound`: change `"/api/owners?lastName=NonExistent"` → `"/api/owners?q=NonExistent"`

**Add new tests** at the end of OwnerTest:

```java
@Test
void listOwners_returnsPaginatedPage() throws Exception {
    // Create a second owner (beforeEach already created George Franklin)
    Owner owner2 = new Owner()
        .setFirstName("Betty").setLastName("Davis")
        .setAddress("638 Cardinal Ave.").setCity("Sun Prairie")
        .setTelephone("6085551749");
    ownerRepository.save(owner2);

    OwnerPageResult page = searchPage("/api/owners?size=1&page=0");

    assertThat(page.size()).isEqualTo(1);
    assertThat(page.totalElements()).isGreaterThanOrEqualTo(2);
    assertThat(page.totalPages()).isGreaterThanOrEqualTo(2);
    assertThat(page.content()).hasSize(1);
}

@Test
void listOwners_sortByNameAsc_firstNameAlphabeticalOrder() throws Exception {
    ownerRepository.save(new Owner()
        .setFirstName("Zara").setLastName("Zebra")
        .setAddress("1 A St").setCity("City").setTelephone("1234567890"));
    ownerRepository.save(new Owner()
        .setFirstName("Aaron").setLastName("Apple")
        .setAddress("2 B St").setCity("City").setTelephone("1234567890"));

    OwnerPageResult page = searchPage("/api/owners?sort=name,asc&size=50");

    List<String> firstNames = page.content().stream().map(OwnerDto::getFirstName).toList();
    assertThat(firstNames).isSortedAccordingTo(String::compareTo);
}

@Test
void listOwners_sortByNameDesc_firstNameReverseOrder() throws Exception {
    ownerRepository.save(new Owner()
        .setFirstName("Zara").setLastName("Zebra")
        .setAddress("1 A St").setCity("City").setTelephone("1234567890"));
    ownerRepository.save(new Owner()
        .setFirstName("Aaron").setLastName("Apple")
        .setAddress("2 B St").setCity("City").setTelephone("1234567890"));

    OwnerPageResult page = searchPage("/api/owners?sort=name,desc&size=50");

    List<String> firstNames = page.content().stream().map(OwnerDto::getFirstName).toList();
    assertThat(firstNames).isSortedAccordingTo((a, b) -> b.compareTo(a));
}

@Test
void listOwners_sortByCity_citiesInOrder() throws Exception {
    ownerRepository.save(new Owner()
        .setFirstName("A").setLastName("B")
        .setAddress("1 St").setCity("Zurich").setTelephone("1234567890"));
    ownerRepository.save(new Owner()
        .setFirstName("C").setLastName("D")
        .setAddress("2 St").setCity("Amsterdam").setTelephone("1234567890"));

    OwnerPageResult page = searchPage("/api/owners?sort=city,asc&size=50");

    List<String> cities = page.content().stream().map(OwnerDto::getCity).toList();
    assertThat(cities).isSortedAccordingTo(String::compareTo);
}

@Test
void listOwners_searchByPetName_returnsOwner() throws Exception {
    // pet "Rosy" belongs to the owner created in @BeforeEach
    List<OwnerDto> result = search("/api/owners?q=Rosy");

    assertThat(result).extracting(OwnerDto::getFirstName).contains("George");
}

@Test
void listOwners_diacriticSearch_matchesAccented() throws Exception {
    ownerRepository.save(new Owner()
        .setFirstName("Müller").setLastName("Hans")
        .setAddress("1 St").setCity("Berlin").setTelephone("1234567890"));

    List<OwnerDto> result = search("/api/owners?q=Muller");

    assertThat(result).extracting(OwnerDto::getFirstName).contains("Müller");
}
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd petclinic-backend && ./mvnw test -Dtest=OwnerTest -q 2>&1 | tail -30
```

Expected: multiple failures — `listOwners_returnsPaginatedPage` fails because response is still a list, not a page object. `getAllWithNameFilter` fails because `?q=` param is not yet handled.

- [ ] **Step 3: Implement OwnerRestController.listOwners**

Replace the `listOwners` method and remove the now-unused private helpers `normalize`, `matchesQuery`, `contains` (they are replaced by DB-side logic):

```java
import java.util.stream.Stream;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
```

Replace `listOwners` (and delete the old `normalize`, `matchesQuery`, `contains` private methods):

```java
@Operation(operationId = "listOwners", summary = "List owners")
@GetMapping(produces = "application/json")
public Page<OwnerDto> listOwners(
        @RequestParam(required = false) String q,
        Pageable pageable) {
    String query = (q == null || q.isBlank()) ? "" : "%" + q.trim() + "%";
    Pageable resolved = resolveSort(pageable);
    return ownerRepository.findByQuery(query, resolved).map(ownerMapper::toOwnerDto);
}

private static Pageable resolveSort(Pageable pageable) {
    List<Sort.Order> orders = pageable.getSort().stream()
        .flatMap(order -> "name".equals(order.getProperty())
            ? Stream.of(
                new Sort.Order(order.getDirection(), "firstName"),
                new Sort.Order(order.getDirection(), "lastName"))
            : Stream.of(order))
        .toList();
    return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.by(orders));
}
```

Add missing imports:
```java
import java.util.List;
import java.util.stream.Stream;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
```

Remove these imports that are no longer used:
```java
// remove: import java.text.Normalizer;
```

- [ ] **Step 4: Run all OwnerTest tests**

```bash
cd petclinic-backend && ./mvnw test -Dtest=OwnerTest -q 2>&1 | tail -30
```

Expected: all tests pass including the previously written `listOwners_oversizedPage_isCappedAt50`.

- [ ] **Step 5: Run full test suite**

```bash
cd petclinic-backend && ./mvnw test -q 2>&1 | tail -20
```

Expected: all tests pass except `MyOpenAPIDidNotChangeTest#my_contract_did_not_change` (the stored contract is now stale — fixed in next task).

- [ ] **Step 6: Commit**

```bash
git add petclinic-backend/src/main/java/org/springframework/samples/petclinic/rest/OwnerRestController.java \
        petclinic-backend/src/test/java/org/springframework/samples/petclinic/rest/OwnerTest.java
git commit -m "feat: paginate owner list with sort=name/city and q search param"
```

---

## Task 6: Update openapi.yaml

The `listOwners` response changed from an array to a `Page` object. The `MyOpenAPIDidNotChangeTest` guards against accidental drift — run its regeneration helper to update the stored contract.

**Files:**
- Modify: `openapi.yaml` (project root)

- [ ] **Step 1: Temporarily enable the update test**

In `MyOpenAPIDidNotChangeTest.java`, remove the `@Disabled` annotation from `updateStoredOpenApiYaml`:

```java
// @Disabled("Run this test manually to update ../openapi.yaml with the current API contract")
@Test
public void updateStoredOpenApiYaml() throws Exception {
```

- [ ] **Step 2: Run the update test**

```bash
cd petclinic-backend && ./mvnw test -Dtest=MyOpenAPIDidNotChangeTest#updateStoredOpenApiYaml -q 2>&1 | tail -10
```

Expected: `WROTE .../openapi.yaml` printed, test passes.

- [ ] **Step 3: Re-add @Disabled**

```java
@Disabled("Run this test manually to update ../openapi.yaml with the current API contract")
@Test
public void updateStoredOpenApiYaml() throws Exception {
```

- [ ] **Step 4: Verify the contract test now passes**

```bash
cd petclinic-backend && ./mvnw test -Dtest=MyOpenAPIDidNotChangeTest -q 2>&1 | tail -10
```

Expected: `Tests run: 1, Failures: 0, Errors: 0`

- [ ] **Step 5: Run full backend test suite**

```bash
cd petclinic-backend && ./mvnw test -q 2>&1 | tail -10
```

Expected: `BUILD SUCCESS`

- [ ] **Step 6: Commit**

```bash
git add openapi.yaml \
        petclinic-backend/src/test/java/org/springframework/samples/petclinic/MyOpenAPIDidNotChangeTest.java
git commit -m "chore: regenerate openapi.yaml after listOwners pagination change"
```

---

## Task 7: Frontend — OwnerService

`owner-page.ts` already has the correct `OwnerPage` interface. Merge `getOwners()` and `searchOwners()` into one method that accepts pagination and sort params.

**Files:**
- Modify: `petclinic-frontend/src/app/owners/owner.service.ts`

- [ ] **Step 1: Write a failing spec**

In `petclinic-frontend/src/app/owners/owner.service.spec.ts`, add a test for the new `getOwners` signature.

Open the file and find or create a test for `getOwners`. Add:

```typescript
it('should call API with pagination and sort params', () => {
  const mockPage: OwnerPage = {
    content: [], totalElements: 0, totalPages: 0, number: 0, size: 10
  };

  service.getOwners({ page: 1, size: 20, sort: 'name', order: 'desc' })
    .subscribe(page => expect(page).toEqual(mockPage));

  const req = httpMock.expectOne(
    r => r.url.includes('/owners') &&
         r.params.get('page') === '1' &&
         r.params.get('size') === '20' &&
         r.params.get('sort') === 'name,desc'
  );
  req.flush(mockPage);
});
```

Add import at top of spec file:
```typescript
import { OwnerPage } from './owner-page';
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd petclinic-frontend && npm test -- --watch=false 2>&1 | grep -E "FAILED|PASSED|ERROR" | tail -20
```

Expected: test fails (getOwners currently has no params).

- [ ] **Step 3: Replace OwnerService implementation**

Replace the full content of `owner.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { Owner } from './owner';
import { OwnerPage } from './owner-page';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { HandleError, HttpErrorHandler } from '../error.service';

export interface OwnerListParams {
  q?: string;
  page: number;
  size: number;
  sort: string;
  order: 'asc' | 'desc';
}

@Injectable()
export class OwnerService {
  entityUrl = environment.REST_API_URL + 'owners';

  private readonly handlerError: HandleError;

  constructor(
    private http: HttpClient,
    private httpErrorHandler: HttpErrorHandler
  ) {
    this.handlerError = httpErrorHandler.createHandleError('OwnerService');
  }

  getOwners(params: OwnerListParams): Observable<OwnerPage> {
    let httpParams = new HttpParams()
      .set('page', params.page)
      .set('size', params.size)
      .set('sort', `${params.sort},${params.order}`);
    if (params.q && params.q.trim()) {
      httpParams = httpParams.set('q', params.q.trim());
    }
    return this.http
      .get<OwnerPage>(this.entityUrl, { params: httpParams })
      .pipe(catchError(this.handlerError('getOwners', { content: [], totalElements: 0, totalPages: 0, number: 0, size: params.size })));
  }

  getOwnerById(ownerId: number): Observable<Owner> {
    return this.http
      .get<Owner>(this.entityUrl + '/' + ownerId)
      .pipe(catchError(this.handlerError('getOwnerById', {} as Owner)));
  }

  addOwner(owner: Owner): Observable<Owner> {
    return this.http
      .post<Owner>(this.entityUrl, owner)
      .pipe(catchError(this.handlerError('addOwner', owner)));
  }

  updateOwner(ownerId: string, owner: Owner): Observable<{}> {
    return this.http
      .put<Owner>(this.entityUrl + '/' + ownerId, owner)
      .pipe(catchError(this.handlerError('updateOwner', owner)));
  }

  deleteOwner(ownerId: string): Observable<{}> {
    return this.http
      .delete<Owner>(this.entityUrl + '/' + ownerId)
      .pipe(catchError(this.handlerError('deleteOwner', [ownerId])));
  }
}
```

- [ ] **Step 4: Run specs**

```bash
cd petclinic-frontend && npm test -- --watch=false 2>&1 | grep -E "FAILED|PASSED|ERROR|SUCCESS" | tail -20
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add petclinic-frontend/src/app/owners/owner.service.ts \
        petclinic-frontend/src/app/owners/owner.service.spec.ts
git commit -m "feat: merge getOwners/searchOwners with pagination and sort params"
```

---

## Task 8: Frontend — OwnerListComponent

**Files:**
- Modify: `petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts`
- Modify: `petclinic-frontend/src/app/owners/owner-list/owner-list.component.html`

- [ ] **Step 1: Replace owner-list.component.ts**

```typescript
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs/operators';
import { Owner } from '../owner';
import { OwnerPage } from '../owner-page';
import { OwnerListParams, OwnerService } from '../owner.service';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.css']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  owners: Owner[] = [];
  totalPages = 0;
  totalElements = 0;
  currentPage = 0;
  pageSize = 10;
  sortColumn: 'name' | 'city' = 'name';
  sortOrder: 'asc' | 'desc' = 'asc';
  isOwnersDataReceived = false;
  errorMessage: string;
  searchControl = new FormControl('');

  readonly pageSizes = [10, 20, 50];

  private destroy$ = new Subject<void>();
  private reload$ = new Subject<void>();

  constructor(private router: Router, private ownerService: OwnerService) {}

  ngOnInit() {
    this.searchControl.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.currentPage = 0;
      this.load();
    });

    this.load();
  }

  private load() {
    const params: OwnerListParams = {
      q: this.searchControl.value || '',
      page: this.currentPage,
      size: this.pageSize,
      sort: this.sortColumn,
      order: this.sortOrder
    };
    this.ownerService.getOwners(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (page: OwnerPage) => {
          this.owners = page.content;
          this.totalPages = page.totalPages;
          this.totalElements = page.totalElements;
          this.isOwnersDataReceived = true;
        },
        error: err => this.errorMessage = err
      });
  }

  sortBy(column: 'name' | 'city') {
    if (this.sortColumn === column) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortOrder = 'asc';
    }
    this.currentPage = 0;
    this.load();
  }

  onPageSizeChange(size: number) {
    this.pageSize = size;
    this.currentPage = 0;
    this.load();
  }

  goToPage(page: number) {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.load();
    }
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSelect(owner: Owner) {
    this.router.navigate(['/owners', owner.id]);
  }

  addOwner() {
    this.router.navigate(['/owners/add']);
  }
}
```

- [ ] **Step 2: Replace owner-list.component.html**

```html
<div class="container-fluid">
  <div class="container xd-container">
    <h2>Owners</h2>

    <div class="form-group">
      <input class="form-control" type="text" placeholder="Search by name, address, city, phone or pet…"
             [formControl]="searchControl"/>
    </div>

    <div *ngIf="isOwnersDataReceived && owners.length === 0">No owners found.</div>

    <div class="table-responsive" id="ownersTable" *ngIf="owners.length > 0">
      <table class="table table-striped">
        <thead>
          <tr>
            <th style="cursor:pointer" (click)="sortBy('name')">
              Name
              <span *ngIf="sortColumn === 'name'">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
            </th>
            <th>Address</th>
            <th style="cursor:pointer" (click)="sortBy('city')">
              City
              <span *ngIf="sortColumn === 'city'">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
            </th>
            <th>Telephone</th>
            <th>Pets</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let owner of owners">
            <td class="ownerFullName">
              <a routerLink="/owners/{{owner.id}}" routerLinkActive="active" (click)="onSelect(owner)">
                {{ owner.firstName }} {{ owner.lastName }}
              </a>
            </td>
            <td>{{ owner.address }}</td>
            <td>{{ owner.city }}</td>
            <td>{{ owner.telephone }}</td>
            <td>
              <span *ngFor="let pet of owner.pets; let last = last">
                {{ pet.name }}<span *ngIf="!last">, </span>
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination controls -->
      <div class="row">
        <div class="col-sm-4">
          <label>Page size:
            <select class="form-control input-sm" style="display:inline-block;width:auto"
                    [ngModel]="pageSize" (ngModelChange)="onPageSizeChange($event)">
              <option *ngFor="let s of pageSizes" [value]="s">{{ s }}</option>
            </select>
          </label>
          <span class="text-muted" style="margin-left:8px">
            {{ totalElements }} total
          </span>
        </div>
        <div class="col-sm-8 text-right">
          <ul class="pagination pagination-sm" style="margin:0">
            <li [class.disabled]="currentPage === 0">
              <a (click)="goToPage(currentPage - 1)" style="cursor:pointer">&laquo;</a>
            </li>
            <li *ngFor="let p of pageNumbers" [class.active]="p === currentPage">
              <a (click)="goToPage(p)" style="cursor:pointer">{{ p + 1 }}</a>
            </li>
            <li [class.disabled]="currentPage === totalPages - 1">
              <a (click)="goToPage(currentPage + 1)" style="cursor:pointer">&raquo;</a>
            </li>
          </ul>
        </div>
      </div>

      <div style="margin-top:8px">
        <button *ngIf="isOwnersDataReceived" class="btn btn-default" (click)="addOwner()">Add Owner</button>
      </div>
    </div>

    <div *ngIf="isOwnersDataReceived && owners.length === 0">
      <button class="btn btn-default" (click)="addOwner()">Add Owner</button>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Check owners.module.ts imports FormsModule for ngModel**

Open `petclinic-frontend/src/app/owners/owners.module.ts`. Verify it imports `FormsModule` from `@angular/forms`. If not, add it:

```typescript
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
// ...
imports: [CommonModule, FormsModule, ReactiveFormsModule, ...]
```

- [ ] **Step 4: Build to verify no compilation errors**

```bash
cd petclinic-frontend && npm run build 2>&1 | tail -20
```

Expected: `Build at: ... - Hash: ... - Time: ...ms` with no errors.

- [ ] **Step 5: Commit**

```bash
git add petclinic-frontend/src/app/owners/owner-list/owner-list.component.ts \
        petclinic-frontend/src/app/owners/owner-list/owner-list.component.html \
        petclinic-frontend/src/app/owners/owners.module.ts
git commit -m "feat: add sortable columns and paginator to owner list"
```

---

## Self-review

Spec requirement checklist:

| Requirement | Task |
|-------------|------|
| `q` replaces `lastName` param | Task 5 |
| DB-level filtering (no in-memory) | Task 3 (findByQuery JPQL) |
| Diacritic-insensitive search | Task 1 (UNACCENT) + Task 3 (query) |
| Pet name search via EXISTS | Task 3 |
| Page<OwnerDto> response | Task 5 |
| sort=name maps to firstName,lastName | Task 5 (resolveSort) |
| sort=city passes through | Task 5 (resolveSort) |
| Default sort: name asc | Task 8 (component defaults) |
| Page size cap at 50 | Task 4 |
| Indexes on (first_name,last_name) and city | Task 2 |
| Sortable Name and City headers with arrow | Task 8 (HTML) |
| Page size selector 10/20/50 | Task 8 (HTML) |
| Paginator prev/next + page numbers | Task 8 (HTML) |
| Search/sort/pageSize change resets to page 0 | Task 8 (component) |
| openapi.yaml updated | Task 6 |
| Test: pagination returns correct page | Task 5 |
| Test: sort by name asc/desc | Task 5 |
| Test: sort by city | Task 5 |
| Test: diacritics search | Task 5 |
| Test: pet name search | Task 5 |
| Test: page size cap (size=3000000 → ≤50) | Task 4 |
| Test: no duplicates for owner with multiple pets | Task 3 |
