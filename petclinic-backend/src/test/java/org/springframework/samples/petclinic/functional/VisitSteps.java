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
