# Functional Feature Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 8 Gherkin functional tests that hit the live PetClinic Spring Boot backend over real HTTP using RestAssured + embedded Postgres (zonky), with the database reset to a minimal known state before every scenario.

**Architecture:**
- Cucumber JUnit Platform Suite picks up features from `src/test/resources/features/functional/*.feature`.
- One `@SpringBootTest(webEnvironment = RANDOM_PORT)` Spring context shared across all scenarios via `@CucumberContextConfiguration`.
- `@AutoConfigureEmbeddedDatabase` (zonky) provides a real Postgres process; Flyway runs all migrations (V1, V2, V3) producing the full sample dataset, but a `@Before` Cucumber hook **truncates the dynamic tables** (`vet_specialties, visits, pets, owners, vets`) before every scenario — leaving lookup data (`types`, `specialties`, `users`, `roles`) intact.
- Step-shared state lives in a `@ScenarioScope` Spring bean (`HttpContext`) holding the last response and IDs created in the scenario.
- HTTP transport: RestAssured pointed at `http://localhost:${randomPort}/api/...`.

**Tech Stack:**
- Spring Boot 3.5.9 / Java 21 (existing)
- Cucumber 7.22.0 — `cucumber-java`, `cucumber-junit-platform-engine` (already on classpath); needs `cucumber-spring`
- RestAssured 5.5.0 (new)
- Zonky embedded Postgres 2.5.1 (existing)
- JUnit Platform Suite (existing)

---

## File Structure

**New files:**
- `petclinic-backend/src/test/java/org/springframework/samples/petclinic/functional/FunctionalCucumberSuite.java` — JUnit Platform Suite runner
- `petclinic-backend/src/test/java/org/springframework/samples/petclinic/functional/CucumberSpringConfig.java` — `@CucumberContextConfiguration` + `@SpringBootTest` setup
- `petclinic-backend/src/test/java/org/springframework/samples/petclinic/functional/HttpContext.java` — `@ScenarioScope` bean: base URI, port, last response, last created IDs
- `petclinic-backend/src/test/java/org/springframework/samples/petclinic/functional/DatabaseHooks.java` — `@Before` truncate hook
- `petclinic-backend/src/test/java/org/springframework/samples/petclinic/functional/OwnerSteps.java` — owner-related step definitions
- `petclinic-backend/src/test/java/org/springframework/samples/petclinic/functional/PetSteps.java`
- `petclinic-backend/src/test/java/org/springframework/samples/petclinic/functional/VisitSteps.java`
- `petclinic-backend/src/test/java/org/springframework/samples/petclinic/functional/VetSteps.java`
- `petclinic-backend/src/test/resources/features/functional/owners.feature`
- `petclinic-backend/src/test/resources/features/functional/pets.feature`
- `petclinic-backend/src/test/resources/features/functional/visits.feature`
- `petclinic-backend/src/test/resources/features/functional/vets.feature`

**Modified files:**
- `petclinic-backend/pom.xml` — add `rest-assured`, `cucumber-spring`

**Scenario distribution (8 total):**
- `owners.feature` (4): register, search by last name, validation on create, profile includes pets
- `pets.feature` (1): enroll pet under owner
- `visits.feature` (2): schedule visit, edit visit
- `vets.feature` (1): list vets with their specialties

---

## Task 1: Add test dependencies

**Files:**
- Modify: `petclinic-backend/pom.xml` (insert in `<dependencies>` block, near other test deps around line 141)

- [ ] **Step 1.1: Add `rest-assured` and `cucumber-spring` to pom.xml**

Insert after the existing `cucumber-junit-platform-engine` dependency:

```xml
        <dependency>
            <groupId>io.cucumber</groupId>
            <artifactId>cucumber-spring</artifactId>
            <version>7.22.0</version>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>io.rest-assured</groupId>
            <artifactId>rest-assured</artifactId>
            <version>5.5.0</version>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>io.rest-assured</groupId>
            <artifactId>json-path</artifactId>
            <version>5.5.0</version>
            <scope>test</scope>
        </dependency>
```

- [ ] **Step 1.2: Verify deps resolve**

Run: `cd petclinic-backend && ./mvnw dependency:resolve -q`
Expected: command exits 0; output contains no `Could not find artifact` errors.

- [ ] **Step 1.3: Commit**

```bash
git add petclinic-backend/pom.xml
git commit -m "test(functional): add rest-assured and cucumber-spring deps"
```

---

## Task 2: Cucumber infrastructure (Suite + Spring config + hooks + smoke scenario)

This task wires up everything Cucumber needs and proves it works end-to-end with one trivial scenario before adding business scenarios. **TDD discipline:** write the smoke `.feature` first; it fails because there's no glue; then add the infra; it passes.

**Files:**
- Create: `petclinic-backend/src/test/resources/features/functional/_smoke.feature`
- Create: `petclinic-backend/src/test/java/org/springframework/samples/petclinic/functional/FunctionalCucumberSuite.java`
- Create: `petclinic-backend/src/test/java/org/springframework/samples/petclinic/functional/CucumberSpringConfig.java`
- Create: `petclinic-backend/src/test/java/org/springframework/samples/petclinic/functional/HttpContext.java`
- Create: `petclinic-backend/src/test/java/org/springframework/samples/petclinic/functional/DatabaseHooks.java`
- Create: `petclinic-backend/src/test/java/org/springframework/samples/petclinic/functional/SmokeSteps.java`

- [ ] **Step 2.1: Write the smoke feature (failing test)**

Create `petclinic-backend/src/test/resources/features/functional/_smoke.feature`:

```gherkin
Feature: Smoke — backend functional test infrastructure

  Scenario: Pet types lookup is seeded
    When I GET "/api/pettypes"
    Then the response status is 200
    And the response JSON array contains an item with "name" equal to "dog"
    And the response JSON array contains an item with "name" equal to "cat"
```

- [ ] **Step 2.2: Write the Suite runner**

Create `petclinic-backend/src/test/java/org/springframework/samples/petclinic/functional/FunctionalCucumberSuite.java`:

```java
package org.springframework.samples.petclinic.functional;

import org.junit.platform.suite.api.ConfigurationParameter;
import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.SelectClasspathResource;
import org.junit.platform.suite.api.Suite;

import static io.cucumber.junit.platform.engine.Constants.GLUE_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.PLUGIN_PROPERTY_NAME;

@Suite
@IncludeEngines("cucumber")
@SelectClasspathResource("features/functional")
@ConfigurationParameter(key = GLUE_PROPERTY_NAME, value = "org.springframework.samples.petclinic.functional")
@ConfigurationParameter(key = PLUGIN_PROPERTY_NAME, value = "pretty")
public class FunctionalCucumberSuite {
}
```

- [ ] **Step 2.3: Run the suite — confirm it fails**

Run: `cd petclinic-backend && ./mvnw test -Dtest=FunctionalCucumberSuite -q`
Expected: build fails. The Cucumber report shows the scenario is `UNDEFINED` (no step definitions yet) or fails because no `@CucumberContextConfiguration` class exists yet.

- [ ] **Step 2.4: Write the Spring context configuration**

Create `petclinic-backend/src/test/java/org/springframework/samples/petclinic/functional/CucumberSpringConfig.java`:

```java
package org.springframework.samples.petclinic.functional;

import io.cucumber.spring.CucumberContextConfiguration;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.springframework.boot.test.context.SpringBootTest;

@CucumberContextConfiguration
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
public class CucumberSpringConfig {
}
```

- [ ] **Step 2.5: Write the HttpContext scenario-scoped bean**

Create `petclinic-backend/src/test/java/org/springframework/samples/petclinic/functional/HttpContext.java`:

```java
package org.springframework.samples.petclinic.functional;

import io.cucumber.spring.ScenarioScope;
import io.restassured.response.Response;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Component
@ScenarioScope
public class HttpContext {

    @Value("${local.server.port}")
    private int port;

    private Response lastResponse;
    private final Map<String, Integer> ids = new HashMap<>();

    public String baseUri() {
        return "http://localhost:" + port;
    }

    public Response getLastResponse() {
        return lastResponse;
    }

    public void setLastResponse(Response response) {
        this.lastResponse = response;
    }

    public void rememberId(String key, int id) {
        ids.put(key, id);
    }

    public int idOf(String key) {
        Integer id = ids.get(key);
        if (id == null) {
            throw new IllegalStateException("No id remembered for key: " + key);
        }
        return id;
    }
}
```

- [ ] **Step 2.6: Write the DatabaseHooks**

Create `petclinic-backend/src/test/java/org/springframework/samples/petclinic/functional/DatabaseHooks.java`:

```java
package org.springframework.samples.petclinic.functional;

import io.cucumber.java.Before;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class DatabaseHooks {

    @Autowired
    private JdbcTemplate jdbc;

    @Before
    public void resetDynamicTables() {
        jdbc.execute("TRUNCATE TABLE vet_specialties, visits, pets, owners, vets RESTART IDENTITY CASCADE");
    }
}
```

- [ ] **Step 2.7: Write the smoke step definitions**

Create `petclinic-backend/src/test/java/org/springframework/samples/petclinic/functional/SmokeSteps.java`:

```java
package org.springframework.samples.petclinic.functional;

import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import io.restassured.RestAssured;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;

public class SmokeSteps {

    @Autowired
    private HttpContext http;

    @When("I GET {string}")
    public void iGet(String path) {
        http.setLastResponse(RestAssured.given().baseUri(http.baseUri()).get(path));
    }

    @Then("the response status is {int}")
    public void theResponseStatusIs(int expected) {
        assertThat(http.getLastResponse().statusCode()).isEqualTo(expected);
    }

    @Then("the response JSON array contains an item with {string} equal to {string}")
    public void theResponseJsonArrayContainsAnItemWithFieldEqualTo(String field, String value) {
        var values = http.getLastResponse().jsonPath().getList(field, String.class);
        assertThat(values).contains(value);
    }
}
```

- [ ] **Step 2.8: Run the suite — confirm smoke scenario passes**

Run: `cd petclinic-backend && ./mvnw test -Dtest=FunctionalCucumberSuite -q`
Expected: build success; output mentions `1 Scenarios (1 passed)`.

- [ ] **Step 2.9: Commit**

```bash
git add petclinic-backend/src/test/java/org/springframework/samples/petclinic/functional \
        petclinic-backend/src/test/resources/features/functional
git commit -m "test(functional): scaffold cucumber + restassured infra with smoke scenario"
```

---

## Task 3: Owner scenarios (4 scenarios in `owners.feature`)

**Files:**
- Create: `petclinic-backend/src/test/resources/features/functional/owners.feature`
- Create: `petclinic-backend/src/test/java/org/springframework/samples/petclinic/functional/OwnerSteps.java`

- [ ] **Step 3.1: Write the failing feature file**

Create `petclinic-backend/src/test/resources/features/functional/owners.feature`:

```gherkin
Feature: Owner management

  Scenario: Register a new owner
    When I register an owner with first name "Eduardo", last name "Rodriquez", address "2693 Commerce St.", city "McFarland", telephone "6085558763"
    Then the response status is 201
    And the owner is searchable by last name "Rodriquez"

  Scenario: Search owners by last name
    Given the following owners exist:
      | firstName | lastName  |
      | George    | Franklin  |
      | Betty     | Davis     |
      | Harold    | Davis     |
    When I GET "/api/owners?lastName=Dav"
    Then the response status is 200
    And the response JSON array has size 2
    And every item in the response has "lastName" equal to "Davis"

  Scenario: Owner profile includes pets with their type
    Given an owner "Jean Coleman" with a "dog" pet named "Samantha" born on "2020-03-15"
    When I fetch the owner "Jean Coleman"
    Then the response status is 200
    And the owner has 1 pet
    And the pet at index 0 has name "Samantha" and type "dog"

  Scenario: Cannot register an owner without a first name
    When I POST to "/api/owners" the JSON:
      """
      {"lastName":"Rodriquez","address":"2693 Commerce St.","city":"McFarland","telephone":"6085558763"}
      """
    Then the response status is 400
```

- [ ] **Step 3.2: Run the suite — confirm 4 new scenarios fail (UNDEFINED)**

Run: `cd petclinic-backend && ./mvnw test -Dtest=FunctionalCucumberSuite -q`
Expected: smoke still passes; the 4 new scenarios fail because steps are undefined.

- [ ] **Step 3.3: Write the OwnerSteps step definitions**

Create `petclinic-backend/src/test/java/org/springframework/samples/petclinic/functional/OwnerSteps.java`:

```java
package org.springframework.samples.petclinic.functional;

import io.cucumber.datatable.DataTable;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import io.restassured.RestAssured;
import io.restassured.http.ContentType;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

public class OwnerSteps {

    @Autowired
    private HttpContext http;

    @Autowired
    private JdbcTemplate jdbc;

    @When("I register an owner with first name {string}, last name {string}, address {string}, city {string}, telephone {string}")
    public void iRegisterAnOwner(String firstName, String lastName, String address, String city, String telephone) {
        String body = """
            {"firstName":"%s","lastName":"%s","address":"%s","city":"%s","telephone":"%s"}
            """.formatted(firstName, lastName, address, city, telephone);

        http.setLastResponse(RestAssured.given()
            .baseUri(http.baseUri())
            .contentType(ContentType.JSON)
            .body(body)
            .post("/api/owners"));
    }

    @When("I POST to {string} the JSON:")
    public void iPostJson(String path, String body) {
        http.setLastResponse(RestAssured.given()
            .baseUri(http.baseUri())
            .contentType(ContentType.JSON)
            .body(body)
            .post(path));
    }

    @Then("the owner is searchable by last name {string}")
    public void theOwnerIsSearchableByLastName(String lastName) {
        var response = RestAssured.given()
            .baseUri(http.baseUri())
            .get("/api/owners?lastName=" + lastName);
        assertThat(response.statusCode()).isEqualTo(200);
        List<String> lastNames = response.jsonPath().getList("lastName", String.class);
        assertThat(lastNames).contains(lastName);
    }

    @Given("the following owners exist:")
    public void theFollowingOwnersExist(DataTable table) {
        for (Map<String, String> row : table.asMaps()) {
            jdbc.update(
                "INSERT INTO owners (first_name, last_name, address, city, telephone) VALUES (?, ?, ?, ?, ?)",
                row.get("firstName"), row.get("lastName"), "addr", "city", "0000000000"
            );
        }
    }

    @Then("the response JSON array has size {int}")
    public void theResponseJsonArrayHasSize(int expected) {
        assertThat(http.getLastResponse().jsonPath().getList("$").size()).isEqualTo(expected);
    }

    @Then("every item in the response has {string} equal to {string}")
    public void everyItemInTheResponseHasFieldEqualTo(String field, String value) {
        List<String> values = http.getLastResponse().jsonPath().getList(field, String.class);
        assertThat(values).isNotEmpty();
        assertThat(values).allMatch(v -> v.equals(value));
    }

    @Given("an owner {string} with a {string} pet named {string} born on {string}")
    public void anOwnerWithAPet(String fullName, String typeName, String petName, String birthDate) {
        String[] parts = fullName.split(" ", 2);
        Integer ownerId = jdbc.queryForObject(
            "INSERT INTO owners (first_name, last_name, address, city, telephone)" +
                " VALUES (?, ?, 'addr', 'city', '0000000000') RETURNING id",
            Integer.class, parts[0], parts[1]);
        Integer typeId = jdbc.queryForObject(
            "SELECT id FROM types WHERE name = ?", Integer.class, typeName);
        jdbc.update(
            "INSERT INTO pets (name, birth_date, type_id, owner_id) VALUES (?, ?, ?, ?)",
            petName, LocalDate.parse(birthDate), typeId, ownerId);
        http.rememberId("owner:" + fullName, ownerId);
    }

    @When("I fetch the owner {string}")
    public void iFetchTheOwner(String fullName) {
        int id = http.idOf("owner:" + fullName);
        http.setLastResponse(RestAssured.given().baseUri(http.baseUri()).get("/api/owners/" + id));
    }

    @Then("the owner has {int} pet(s)")
    public void theOwnerHasNPets(int expected) {
        assertThat(http.getLastResponse().jsonPath().getList("pets").size()).isEqualTo(expected);
    }

    @Then("the pet at index {int} has name {string} and type {string}")
    public void thePetAtIndexHasNameAndType(int index, String name, String type) {
        var jp = http.getLastResponse().jsonPath();
        assertThat(jp.getString("pets[" + index + "].name")).isEqualTo(name);
        assertThat(jp.getString("pets[" + index + "].type.name")).isEqualTo(type);
    }
}
```

- [ ] **Step 3.4: Run the suite — confirm all 4 owner scenarios pass**

Run: `cd petclinic-backend && ./mvnw test -Dtest=FunctionalCucumberSuite -q`
Expected: `5 Scenarios (5 passed)` (smoke + 4 owners).

- [ ] **Step 3.5: Commit**

```bash
git add petclinic-backend/src/test/resources/features/functional/owners.feature \
        petclinic-backend/src/test/java/org/springframework/samples/petclinic/functional/OwnerSteps.java
git commit -m "test(functional): owner register, search, profile, validation scenarios"
```

---

## Task 4: Pet enrollment scenario (`pets.feature`)

**Files:**
- Create: `petclinic-backend/src/test/resources/features/functional/pets.feature`
- Create: `petclinic-backend/src/test/java/org/springframework/samples/petclinic/functional/PetSteps.java`

- [ ] **Step 4.1: Write the failing feature**

Create `petclinic-backend/src/test/resources/features/functional/pets.feature`:

```gherkin
Feature: Pet enrollment

  Scenario: Enroll a new pet under an existing owner
    Given an owner "Maria Escobito" exists
    When I enroll a "dog" pet named "Rex" born on "2024-01-15" for "Maria Escobito"
    Then the response status is 201
    And owner "Maria Escobito" has 1 pet named "Rex" of type "dog"
```

- [ ] **Step 4.2: Run — confirm new scenario fails (UNDEFINED)**

Run: `cd petclinic-backend && ./mvnw test -Dtest=FunctionalCucumberSuite -q`
Expected: existing scenarios pass; pet scenario undefined.

- [ ] **Step 4.3: Write PetSteps**

Create `petclinic-backend/src/test/java/org/springframework/samples/petclinic/functional/PetSteps.java`:

```java
package org.springframework.samples.petclinic.functional;

import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import io.restassured.RestAssured;
import io.restassured.http.ContentType;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

public class PetSteps {

    @Autowired
    private HttpContext http;

    @Autowired
    private JdbcTemplate jdbc;

    @Given("an owner {string} exists")
    public void anOwnerExists(String fullName) {
        String[] parts = fullName.split(" ", 2);
        Integer ownerId = jdbc.queryForObject(
            "INSERT INTO owners (first_name, last_name, address, city, telephone)" +
                " VALUES (?, ?, 'addr', 'city', '0000000000') RETURNING id",
            Integer.class, parts[0], parts[1]);
        http.rememberId("owner:" + fullName, ownerId);
    }

    @When("I enroll a {string} pet named {string} born on {string} for {string}")
    public void iEnrollAPet(String typeName, String petName, String birthDate, String fullName) {
        int ownerId = http.idOf("owner:" + fullName);
        Integer typeId = jdbc.queryForObject(
            "SELECT id FROM types WHERE name = ?", Integer.class, typeName);

        String body = """
            {"name":"%s","birthDate":"%s","type":{"id":%d,"name":"%s"}}
            """.formatted(petName, birthDate, typeId, typeName);

        http.setLastResponse(RestAssured.given()
            .baseUri(http.baseUri())
            .contentType(ContentType.JSON)
            .body(body)
            .post("/api/owners/" + ownerId + "/pets"));
    }

    @Then("owner {string} has {int} pet named {string} of type {string}")
    public void ownerHasPetNamedOfType(String fullName, int expectedCount, String petName, String typeName) {
        int ownerId = http.idOf("owner:" + fullName);
        var response = RestAssured.given().baseUri(http.baseUri()).get("/api/owners/" + ownerId);
        assertThat(response.statusCode()).isEqualTo(200);
        var pets = response.jsonPath().getList("pets");
        assertThat(pets).hasSize(expectedCount);
        assertThat(response.jsonPath().getString("pets[0].name")).isEqualTo(petName);
        assertThat(response.jsonPath().getString("pets[0].type.name")).isEqualTo(typeName);
    }
}
```

- [ ] **Step 4.4: Run — confirm pet scenario passes**

Run: `cd petclinic-backend && ./mvnw test -Dtest=FunctionalCucumberSuite -q`
Expected: `6 Scenarios (6 passed)`.

- [ ] **Step 4.5: Commit**

```bash
git add petclinic-backend/src/test/resources/features/functional/pets.feature \
        petclinic-backend/src/test/java/org/springframework/samples/petclinic/functional/PetSteps.java
git commit -m "test(functional): pet enrollment scenario"
```

---

## Task 5: Visit scenarios (`visits.feature`, 2 scenarios)

**Files:**
- Create: `petclinic-backend/src/test/resources/features/functional/visits.feature`
- Create: `petclinic-backend/src/test/java/org/springframework/samples/petclinic/functional/VisitSteps.java`

- [ ] **Step 5.1: Write the failing feature**

Create `petclinic-backend/src/test/resources/features/functional/visits.feature`:

```gherkin
Feature: Visits

  Background:
    Given an owner "Peter McTavish" with a "dog" pet "Samantha"

  Scenario: Schedule a visit for a pet
    When I schedule a visit for "Samantha" on "2026-05-10" with description "rabies shot"
    Then the response status is 201
    And "Samantha" has 1 visit with description "rabies shot"

  Scenario: Edit a visit description
    Given a visit for "Samantha" on "2026-04-01" described as "checkup"
    When I update that visit's description to "annual checkup"
    Then the response status is 204
    And the visit's description is "annual checkup"
```

- [ ] **Step 5.2: Run — confirm scenarios fail (UNDEFINED)**

Run: `cd petclinic-backend && ./mvnw test -Dtest=FunctionalCucumberSuite -q`
Expected: existing pass; visit scenarios undefined.

- [ ] **Step 5.3: Write VisitSteps**

Create `petclinic-backend/src/test/java/org/springframework/samples/petclinic/functional/VisitSteps.java`:

```java
package org.springframework.samples.petclinic.functional;

import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import io.restassured.RestAssured;
import io.restassured.http.ContentType;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

public class VisitSteps {

    @Autowired
    private HttpContext http;

    @Autowired
    private JdbcTemplate jdbc;

    @Given("an owner {string} with a {string} pet {string}")
    public void anOwnerWithAPet(String fullName, String typeName, String petName) {
        String[] parts = fullName.split(" ", 2);
        Integer ownerId = jdbc.queryForObject(
            "INSERT INTO owners (first_name, last_name, address, city, telephone)" +
                " VALUES (?, ?, 'addr', 'city', '0000000000') RETURNING id",
            Integer.class, parts[0], parts[1]);
        Integer typeId = jdbc.queryForObject(
            "SELECT id FROM types WHERE name = ?", Integer.class, typeName);
        Integer petId = jdbc.queryForObject(
            "INSERT INTO pets (name, birth_date, type_id, owner_id)" +
                " VALUES (?, DATE '2020-01-01', ?, ?) RETURNING id",
            Integer.class, petName, typeId, ownerId);
        http.rememberId("owner:" + fullName, ownerId);
        http.rememberId("pet:" + petName, petId);
    }

    @When("I schedule a visit for {string} on {string} with description {string}")
    public void iScheduleAVisit(String petName, String date, String description) {
        int petId = http.idOf("pet:" + petName);
        String body = """
            {"petId":%d,"date":"%s","description":"%s"}
            """.formatted(petId, date, description);

        http.setLastResponse(RestAssured.given()
            .baseUri(http.baseUri())
            .contentType(ContentType.JSON)
            .body(body)
            .post("/api/visits"));
    }

    @Then("{string} has {int} visit with description {string}")
    public void petHasVisitsWithDescription(String petName, int expectedCount, String description) {
        int petId = http.idOf("pet:" + petName);
        var response = RestAssured.given().baseUri(http.baseUri()).get("/api/visits");
        assertThat(response.statusCode()).isEqualTo(200);
        var matching = response.jsonPath().getList(
            "findAll { it.petId == " + petId + " && it.description == '" + description + "' }");
        assertThat(matching).hasSize(expectedCount);
    }

    @Given("a visit for {string} on {string} described as {string}")
    public void aVisitForOnDescribedAs(String petName, String date, String description) {
        int petId = http.idOf("pet:" + petName);
        Integer visitId = jdbc.queryForObject(
            "INSERT INTO visits (pet_id, visit_date, description) VALUES (?, ?, ?) RETURNING id",
            Integer.class, petId, LocalDate.parse(date), description);
        http.rememberId("visit:current", visitId);
    }

    @When("I update that visit's description to {string}")
    public void iUpdateVisitDescription(String newDescription) {
        int visitId = http.idOf("visit:current");
        var existing = RestAssured.given().baseUri(http.baseUri()).get("/api/visits/" + visitId);
        assertThat(existing.statusCode()).isEqualTo(200);

        String body = """
            {"id":%d,"petId":%d,"date":"%s","description":"%s"}
            """.formatted(
                visitId,
                existing.jsonPath().getInt("petId"),
                existing.jsonPath().getString("date"),
                newDescription);

        http.setLastResponse(RestAssured.given()
            .baseUri(http.baseUri())
            .contentType(ContentType.JSON)
            .body(body)
            .put("/api/visits/" + visitId));
    }

    @Then("the visit's description is {string}")
    public void theVisitDescriptionIs(String expected) {
        int visitId = http.idOf("visit:current");
        var response = RestAssured.given().baseUri(http.baseUri()).get("/api/visits/" + visitId);
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.jsonPath().getString("description")).isEqualTo(expected);
    }
}
```

> **Note on the 204 status:** The existing `VisitTest.update_ok` asserts `is2xxSuccessful` not a specific code. If running this scenario reveals the actual PUT response is `200` not `204`, change the feature's expected status to match what the controller actually returns (do not change the controller for this).

- [ ] **Step 5.4: Run — confirm visit scenarios pass**

Run: `cd petclinic-backend && ./mvnw test -Dtest=FunctionalCucumberSuite -q`
Expected: `8 Scenarios (8 passed)`. If "Edit a visit description" fails on status code, update the feature to the actual returned code (e.g., `200`) and re-run.

- [ ] **Step 5.5: Commit**

```bash
git add petclinic-backend/src/test/resources/features/functional/visits.feature \
        petclinic-backend/src/test/java/org/springframework/samples/petclinic/functional/VisitSteps.java
git commit -m "test(functional): visit schedule and edit scenarios"
```

---

## Task 6: Vet scenario (`vets.feature`)

**Files:**
- Create: `petclinic-backend/src/test/resources/features/functional/vets.feature`
- Create: `petclinic-backend/src/test/java/org/springframework/samples/petclinic/functional/VetSteps.java`

- [ ] **Step 6.1: Write the failing feature**

Create `petclinic-backend/src/test/resources/features/functional/vets.feature`:

```gherkin
Feature: Vets

  Scenario: List vets shows their specialties
    Given a vet "Helen Leary" with specialties "radiology", "dentistry"
    And a vet "Linda Douglas" with specialties "surgery"
    When I GET "/api/vets"
    Then the response status is 200
    And vet "Helen Leary" has specialties "radiology", "dentistry"
    And vet "Linda Douglas" has specialties "surgery"
```

- [ ] **Step 6.2: Run — confirm scenario fails (UNDEFINED)**

Run: `cd petclinic-backend && ./mvnw test -Dtest=FunctionalCucumberSuite -q`

- [ ] **Step 6.3: Write VetSteps**

Create `petclinic-backend/src/test/java/org/springframework/samples/petclinic/functional/VetSteps.java`:

```java
package org.springframework.samples.petclinic.functional;

import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

public class VetSteps {

    @Autowired
    private HttpContext http;

    @Autowired
    private JdbcTemplate jdbc;

    @Given("a vet {string} with specialties {string}")
    public void aVetWithSpecialties(String fullName, String specialtiesCsv) {
        String[] parts = fullName.split(" ", 2);
        Integer vetId = jdbc.queryForObject(
            "INSERT INTO vets (first_name, last_name) VALUES (?, ?) RETURNING id",
            Integer.class, parts[0], parts[1]);
        for (String specialty : specialtiesCsv.split(",\\s*")) {
            Integer specialtyId = jdbc.queryForObject(
                "SELECT id FROM specialties WHERE name = ?", Integer.class, specialty);
            jdbc.update(
                "INSERT INTO vet_specialties (vet_id, specialty_id) VALUES (?, ?)",
                vetId, specialtyId);
        }
        http.rememberId("vet:" + fullName, vetId);
    }

    @Then("vet {string} has specialties {string}")
    public void vetHasSpecialties(String fullName, String specialtiesCsv) {
        int vetId = http.idOf("vet:" + fullName);
        var response = http.getLastResponse();
        var jp = response.jsonPath();
        List<Integer> ids = jp.getList("id", Integer.class);
        int index = ids.indexOf(vetId);
        assertThat(index).as("vet %s not in response", fullName).isNotNegative();
        List<String> actualSpecialties = jp.getList("[" + index + "].specialties.name", String.class);
        List<String> expected = Arrays.asList(specialtiesCsv.split(",\\s*"));
        assertThat(actualSpecialties).containsExactlyInAnyOrderElementsOf(expected);
    }
}
```

- [ ] **Step 6.4: Run — confirm vet scenario passes**

Run: `cd petclinic-backend && ./mvnw test -Dtest=FunctionalCucumberSuite -q`
Expected: `9 Scenarios (9 passed)` (smoke + 4 owners + 1 pet + 2 visits + 1 vet).

- [ ] **Step 6.5: Commit**

```bash
git add petclinic-backend/src/test/resources/features/functional/vets.feature \
        petclinic-backend/src/test/java/org/springframework/samples/petclinic/functional/VetSteps.java
git commit -m "test(functional): list vets with their specialties scenario"
```

---

## Task 7: Final verification

- [ ] **Step 7.1: Run full backend test suite (no skips) and confirm green**

Run: `cd petclinic-backend && ./mvnw test -q`
Expected: BUILD SUCCESS. The Cucumber suite reports `9 Scenarios (9 passed)`. All previously-existing tests still pass.

- [ ] **Step 7.2: Confirm DB reset works — re-run twice**

Run: `cd petclinic-backend && ./mvnw test -Dtest=FunctionalCucumberSuite -q && ./mvnw test -Dtest=FunctionalCucumberSuite -q`
Expected: both runs pass identically. (If the second run fails it means the truncate hook is missing a table.)

---

## Self-Review Notes

- **Spec coverage:** The 8 user-confirmed scenarios from the brainstorming step (Owner register / search / profile / validation; Pet enrollment; Visit schedule + edit; Vet listing) are each covered by exactly one scenario.
- **Smoke scenario:** Added on top — proves infra works before any business scenario is touched. It's the first failing test in the TDD cycle.
- **Status code in `Edit a visit description`:** Flagged inline as a possible mismatch; instructions tell the executor to align the feature with the controller's actual response, not the other way around.
- **Type/name consistency:** Step phrases that touch the same noun across files use consistent wording (e.g. `an owner "X" exists` vs `an owner "X" with a "Y" pet "Z"` are separate phrases — Cucumber will not collide on regex matching).
- **No placeholders:** every step has the exact code, exact path, exact command, and exact expected output.
