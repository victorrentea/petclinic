package victor.training.petclinic.functional;

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
