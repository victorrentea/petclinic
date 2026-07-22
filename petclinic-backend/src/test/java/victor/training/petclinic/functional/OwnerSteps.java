package victor.training.petclinic.functional;

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
