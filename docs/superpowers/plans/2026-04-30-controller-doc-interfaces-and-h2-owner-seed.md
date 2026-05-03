# Controller Doc Interfaces and H2 Owner Seed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Swagger/OpenAPI annotations out of `OwnerRestController` and `UserRestController` into dedicated Java interfaces, and add 1,000 deterministic dummy owners to the H2 dev dataset for pagination testing.

**Architecture:** Keep Spring request-mapping and business logic in concrete controllers, but move documentation-only annotations to controller-specific API interfaces that the controllers implement. Extend only the H2 seed script so local/dev pagination testing gets many pages without changing PostgreSQL seeds or runtime code paths.

**Tech Stack:** Java 21, Spring Boot 3, springdoc-openapi annotations, MockMvc tests, H2 SQL seed data

---

### Task 1: Extract annotated controller API interfaces

**Files:**
- Create: `petclinic-backend/src/main/java/org/springframework/samples/petclinic/rest/api/OwnerRestApi.java`
- Create: `petclinic-backend/src/main/java/org/springframework/samples/petclinic/rest/api/UserRestApi.java`
- Modify: `petclinic-backend/src/main/java/org/springframework/samples/petclinic/rest/OwnerRestController.java`
- Modify: `petclinic-backend/src/main/java/org/springframework/samples/petclinic/rest/UserRestController.java`
- Test: `petclinic-backend/src/test/java/org/springframework/samples/petclinic/rest/OwnerTest.java`
- Test: `petclinic-backend/src/test/java/org/springframework/samples/petclinic/rest/UserTest.java`
- Test: `petclinic-backend/src/test/java/org/springframework/samples/petclinic/MyOpenAPIDidNotChangeTest.java`

- [ ] **Step 1: Write the failing contract-preservation test**

```java
@Test
void my_contract_did_not_change() throws Exception {
    String contractExtractedFromCode = mockMvc.perform(get("/v3/api-docs.yaml"))
        .andReturn().getResponse().getContentAsString();

    String contractSavedOnGit = contractFile.getContentAsString(defaultCharset())
        .replace(":8080", "");

    assertThat(prettifyYaml(contractExtractedFromCode))
        .isEqualTo(prettifyYaml(contractSavedOnGit));
}
```

- [ ] **Step 2: Run the contract test to verify the current state before refactor**

Run: `cd petclinic-backend && ./mvnw -q -Dtest=MyOpenAPIDidNotChangeTest test`
Expected: PASS before the refactor, then PASS again after the interface extraction

- [ ] **Step 3: Create `OwnerRestApi` with Swagger annotations and Spring method signatures**

```java
package org.springframework.samples.petclinic.rest.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.samples.petclinic.rest.dto.OwnerDto;
import org.springframework.samples.petclinic.rest.dto.OwnerFieldsDto;
import org.springframework.samples.petclinic.rest.dto.OwnerPageDto;
import org.springframework.samples.petclinic.rest.dto.PetDto;
import org.springframework.samples.petclinic.rest.dto.PetFieldsDto;
import org.springframework.samples.petclinic.rest.dto.VisitFieldsDto;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;

public interface OwnerRestApi {

    @Operation(operationId = "listOwners", summary = "List owners")
    OwnerPageDto listOwners(
        @Parameter(in = ParameterIn.QUERY, description = "Free-text owner search query.")
        @RequestParam(name = "query", required = false) String query,
        @Parameter(in = ParameterIn.QUERY, description = "Zero-based owner page index.",
            schema = @Schema(defaultValue = "0", minimum = "0"))
        @RequestParam(name = "page", defaultValue = "0") int page,
        @Parameter(in = ParameterIn.QUERY, description = "Owner page size.",
            schema = @Schema(defaultValue = "10", allowableValues = {"10", "20"}))
        @RequestParam(name = "size", defaultValue = "10") int size,
        @Parameter(in = ParameterIn.QUERY, description = "Owner sort field and direction.",
            schema = @Schema(defaultValue = "name,asc", allowableValues = {"name,asc", "name,desc", "city,asc", "city,desc"}))
        @RequestParam(name = "sort", defaultValue = "name,asc") String sort
    );

    @Operation(operationId = "getOwner", summary = "Get an owner by ID")
    OwnerDto getOwner(@PathVariable int ownerId);

    @Operation(operationId = "addOwner", summary = "Create an owner")
    ResponseEntity<Void> addOwner(@RequestBody @Valid OwnerFieldsDto ownerFieldsDto);

    @Operation(operationId = "updateOwner", summary = "Update an owner")
    void updateOwner(@PathVariable int ownerId, @RequestBody @Valid OwnerFieldsDto ownerFieldsDto);

    @Operation(operationId = "deleteOwner", summary = "Delete an owner by ID")
    void deleteOwner(@PathVariable int ownerId);

    @Operation(operationId = "addPetToOwner", summary = "Add a pet to an owner")
    ResponseEntity<Void> addPetToOwner(@PathVariable int ownerId, @RequestBody @Valid PetFieldsDto petFieldsDto);

    @Operation(operationId = "updateOwnersPet", summary = "Update an owner's pet")
    void updateOwnersPet(@PathVariable int ownerId, @PathVariable int petId, @RequestBody PetFieldsDto petFieldsDto);

    @Operation(operationId = "addVisitToOwner", summary = "Add a visit for an owner's pet")
    ResponseEntity<Void> addVisitToOwner(@PathVariable int ownerId, @PathVariable int petId,
        @RequestBody VisitFieldsDto visitFieldsDto);

    @Operation(operationId = "getOwnersPet", summary = "Get a pet belonging to an owner")
    PetDto getOwnersPet(@PathVariable int ownerId, @PathVariable int petId);
}
```

- [ ] **Step 4: Create `UserRestApi` with Swagger annotations and Spring method signatures**

```java
package org.springframework.samples.petclinic.rest.api;

import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.samples.petclinic.rest.dto.UserDto;
import org.springframework.web.bind.annotation.RequestBody;

public interface UserRestApi {

    @Operation(operationId = "addUser", summary = "Create a user")
    ResponseEntity<UserDto> addUser(@RequestBody @Valid UserDto userDto);
}
```

- [ ] **Step 5: Make both controllers implement their interfaces and remove Swagger imports from controllers**

```java
@RestController
@RequestMapping("/api/owners")
@RequiredArgsConstructor
@PreAuthorize("hasRole(@roles.OWNER_ADMIN)")
public class OwnerRestController implements OwnerRestApi {
```

```java
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole(@roles.ADMIN)")
public class UserRestController implements UserRestApi {
```

- [ ] **Step 6: Run focused tests after the refactor**

Run: `cd petclinic-backend && ./mvnw -q -Dtest=OwnerTest,UserTest,MyOpenAPIDidNotChangeTest test`
Expected: PASS

- [ ] **Step 7: Commit the controller doc-interface refactor**

```bash
git add \
  petclinic-backend/src/main/java/org/springframework/samples/petclinic/rest/api/OwnerRestApi.java \
  petclinic-backend/src/main/java/org/springframework/samples/petclinic/rest/api/UserRestApi.java \
  petclinic-backend/src/main/java/org/springframework/samples/petclinic/rest/OwnerRestController.java \
  petclinic-backend/src/main/java/org/springframework/samples/petclinic/rest/UserRestController.java \
  openapi.yaml
git commit -m "refactor: move controller docs to api interfaces"
```

### Task 2: Expand H2 owner seed data for pagination testing

**Files:**
- Modify: `petclinic-backend/src/main/resources/db/h2/data.sql`
- Test: `petclinic-backend/src/test/java/org/springframework/samples/petclinic/rest/OwnerTest.java`
- Test: `petclinic-backend/src/test/java/org/springframework/samples/petclinic/MyOpenAPIDidNotChangeTest.java`

- [ ] **Step 1: Write the failing pagination-volume test**

```java
@Test
void getAllIncludesLargeSeedDataset() throws Exception {
    mockMvc.perform(get("/api/owners"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1000)));
}
```

- [ ] **Step 2: Run the owner test to verify it fails before seed expansion**

Run: `cd petclinic-backend && ./mvnw -q -Dtest=OwnerTest#getAllIncludesLargeSeedDataset test`
Expected: FAIL because the default H2 dataset currently has far fewer owners

- [ ] **Step 3: Add 1,000 deterministic dummy owners to `db/h2/data.sql`**

```sql
INSERT INTO owners (first_name, last_name, address, city, telephone) VALUES
('Alden', 'Random0001', '1001 Pagination Ave.', 'Madison', '7000000001'),
('Bria', 'Random0002', '1002 Pagination Ave.', 'Monona', '7000000002'),
('Cato', 'Random0003', '1003 Pagination Ave.', 'Sun Prairie', '7000000003');
```

Repeat the same pattern until 1,000 rows are appended, cycling through a small fixed list of first names and cities so the data looks random enough for manual browsing but stays deterministic in git.

- [ ] **Step 4: Run focused owner tests after seed expansion**

Run: `cd petclinic-backend && ./mvnw -q -Dtest=OwnerTest test`
Expected: PASS

- [ ] **Step 5: Run the OpenAPI snapshot test to confirm no contract drift from the data-only change**

Run: `cd petclinic-backend && ./mvnw -q -Dtest=MyOpenAPIDidNotChangeTest test`
Expected: PASS

- [ ] **Step 6: Commit the H2 seed expansion**

```bash
git add petclinic-backend/src/main/resources/db/h2/data.sql \
        petclinic-backend/src/test/java/org/springframework/samples/petclinic/rest/OwnerTest.java
git commit -m "test: add large H2 owner seed dataset"
```
