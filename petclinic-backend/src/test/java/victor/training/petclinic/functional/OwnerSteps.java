package victor.training.petclinic.functional;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.List;

import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import io.restassured.RestAssured;
import io.restassured.http.ContentType;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

public class OwnerSteps {

    @Autowired
    private HttpContext http;

    @Autowired
    private JdbcTemplate jdbc;

    @Given("owner {string} lives at {string} in {string} with telephone {string}")
    public void ownerLivesAtInWithTelephone(String fullName, String address, String city, String telephone) {
        String[] parts = splitName(fullName);
        Integer ownerId = jdbc.queryForObject(
            "INSERT INTO owners (first_name, last_name, address, city, telephone) VALUES (?, ?, ?, ?, ?) RETURNING id",
            Integer.class,
            parts[0],
            parts[1],
            address,
            city,
            telephone
        );
        http.rememberId(ownerKey(fullName), ownerId);
    }

    @Given("owner {string} has a {string} pet named {string} born on {string}")
    public void ownerHasAPetNamedBornOn(String fullName, String typeName, String petName, String birthDate) {
        int ownerId = ownerId(fullName);
        Integer typeId = typeId(typeName);
        Integer petId = jdbc.queryForObject(
            "INSERT INTO pets (name, birth_date, type_id, owner_id) VALUES (?, ?, ?, ?) RETURNING id",
            Integer.class,
            petName,
            LocalDate.parse(birthDate),
            typeId,
            ownerId
        );
        http.rememberId(petKey(fullName, petName), petId);
    }

    @When("I search owners with query {string}")
    public void iSearchOwnersWithQuery(String query) {
        http.setLastResponse(RestAssured.given()
            .baseUri(http.baseUri())
            .queryParam("query", query)
            .get("/api/owners"));
    }

    @When("I fetch the owner {string}")
    public void iFetchTheOwner(String fullName) {
        http.setLastResponse(RestAssured.given()
            .baseUri(http.baseUri())
            .get("/api/owners/" + ownerId(fullName)));
    }

    @When("I update owner {string} to first name {string} with body id")
    public void iUpdateOwnerToFirstNameWithBodyId(String fullName, String firstName) {
        int ownerId = ownerId(fullName);
        String body = """
            {"id":%d,"firstName":"%s","lastName":"Franklin","address":"123 Unique Search Street","city":"CaseTown","telephone":"1234509876"}
            """.formatted(ownerId, firstName);
        put("/api/owners/" + ownerId, body);
    }

    @When("I update owner {string} to first name {string} without body id")
    public void iUpdateOwnerToFirstNameWithoutBodyId(String fullName, String firstName) {
        int ownerId = ownerId(fullName);
        String body = """
            {"firstName":"%s","lastName":"Franklin","address":"123 Unique Search Street","city":"CaseTown","telephone":"1234509876"}
            """.formatted(firstName);
        put("/api/owners/" + ownerId, body);
    }

    @When("I update owner {string} with an invalid empty first name")
    public void iUpdateOwnerWithAnInvalidEmptyFirstName(String fullName) {
        int ownerId = ownerId(fullName);
        String body = """
            {"firstName":"","lastName":"Franklin","address":"123 Unique Search Street","city":"CaseTown","telephone":"1234509876"}
            """;
        put("/api/owners/" + ownerId, body);
    }

    @When("I delete owner {string}")
    public void iDeleteOwner(String fullName) {
        http.setLastResponse(RestAssured.given()
            .baseUri(http.baseUri())
            .delete("/api/owners/" + ownerId(fullName)));
    }

    @When("I add a pet without a name to owner {string} with type {string} and birth date {string}")
    public void iAddAPetWithoutANameToOwnerWithTypeAndBirthDate(String fullName, String typeName, String birthDate) {
        String body = """
            {"birthDate":"%s","type":{"id":%d,"name":"%s"}}
            """.formatted(birthDate, typeId(typeName), typeName);
        http.setLastResponse(RestAssured.given()
            .baseUri(http.baseUri())
            .contentType(ContentType.JSON)
            .body(body)
            .post("/api/owners/" + ownerId(fullName) + "/pets"));
    }

    @When("I fetch pet {string} of owner {string}")
    public void iFetchPetOfOwner(String petName, String fullName) {
        http.setLastResponse(RestAssured.given()
            .baseUri(http.baseUri())
            .get("/api/owners/" + ownerId(fullName) + "/pets/" + petId(fullName, petName)));
    }

    @When("I fetch pet {string} of owner {string} using missing owner id")
    public void iFetchPetOfOwnerUsingMissingOwnerId(String petName, String fullName) {
        http.setLastResponse(RestAssured.given()
            .baseUri(http.baseUri())
            .get("/api/owners/99999/pets/" + petId(fullName, petName)));
    }

    @When("I fetch a missing pet of owner {string}")
    public void iFetchAMissingPetOfOwner(String fullName) {
        http.setLastResponse(RestAssured.given()
            .baseUri(http.baseUri())
            .get("/api/owners/" + ownerId(fullName) + "/pets/99999"));
    }

    @When("I update pet {string} of owner {string} to name {string} born on {string} with type {string}")
    public void iUpdatePetOfOwnerToNameBornOnWithType(String petName, String fullName, String newName, String birthDate,
        String typeName) {
        putPet(fullName, petName, ownerId(fullName), newName, birthDate, typeName);
    }

    @When("I update pet {string} of owner {string} using missing owner id to name {string} born on {string} with type {string}")
    public void iUpdatePetOfOwnerUsingMissingOwnerIdToNameBornOnWithType(String petName, String fullName, String newName,
        String birthDate, String typeName) {
        putPet(fullName, petName, 99999, newName, birthDate, typeName);
    }

    @When("I update a missing pet of owner {string} to name {string} born on {string} with type {string}")
    public void iUpdateAMissingPetOfOwnerToNameBornOnWithType(String fullName, String newName, String birthDate,
        String typeName) {
        String body = petBody(newName, birthDate, typeName);
        put("/api/owners/" + ownerId(fullName) + "/pets/99999", body);
    }

    @Then("the response JSON array contains owner {string}")
    public void theResponseJsonArrayContainsOwner(String fullName) {
        List<String> firstNames = http.getLastResponse().jsonPath().getList("firstName", String.class);
        List<String> lastNames = http.getLastResponse().jsonPath().getList("lastName", String.class);
        assertThat(firstNames).hasSize(lastNames.size());

        boolean found = false;
        for (int i = 0; i < firstNames.size(); i++) {
            if ((firstNames.get(i) + " " + lastNames.get(i)).equals(fullName)) {
                found = true;
                break;
            }
        }
        assertThat(found).isTrue();
    }

    @Then("the response JSON field {string} equals {string}")
    public void theResponseJsonFieldEquals(String field, String expected) {
        assertThat(http.getLastResponse().jsonPath().getString(field)).isEqualTo(expected);
    }

    @Then("the response JSON number field {string} equals the id of owner {string}")
    public void theResponseJsonNumberFieldEqualsTheIdOfOwner(String field, String fullName) {
        assertThat(http.getLastResponse().jsonPath().getInt(field)).isEqualTo(ownerId(fullName));
    }

    @Then("the response JSON number field {string} equals the id of pet {string} for owner {string}")
    public void theResponseJsonNumberFieldEqualsTheIdOfPetForOwner(String field, String petName, String fullName) {
        assertThat(http.getLastResponse().jsonPath().getInt(field)).isEqualTo(petId(fullName, petName));
    }

    @Then("owner {string} now has first name {string}")
    public void ownerNowHasFirstName(String fullName, String expectedFirstName) {
        var response = RestAssured.given()
            .baseUri(http.baseUri())
            .get("/api/owners/" + ownerId(fullName));
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.jsonPath().getString("firstName")).isEqualTo(expectedFirstName);
    }

    @Then("owner {string} is not found")
    public void ownerIsNotFound(String fullName) {
        var response = RestAssured.given()
            .baseUri(http.baseUri())
            .get("/api/owners/" + ownerId(fullName));
        assertThat(response.statusCode()).isEqualTo(404);
    }

    @Then("pet {string} of owner {string} now has name {string} and type {string}")
    public void petOfOwnerNowHasNameAndType(String originalPetName, String fullName, String expectedName, String expectedType) {
        var response = RestAssured.given()
            .baseUri(http.baseUri())
            .get("/api/owners/" + ownerId(fullName) + "/pets/" + petId(fullName, originalPetName));
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.jsonPath().getString("name")).isEqualTo(expectedName);
        assertThat(response.jsonPath().getString("type.name")).isEqualTo(expectedType);
    }

    private void putPet(String fullName, String petName, int ownerId, String newName, String birthDate, String typeName) {
        String body = petBody(newName, birthDate, typeName);
        put("/api/owners/" + ownerId + "/pets/" + petId(fullName, petName), body);
    }

    private String petBody(String name, String birthDate, String typeName) {
        return """
            {"name":"%s","birthDate":"%s","type":{"id":%d,"name":"%s"}}
            """.formatted(name, birthDate, typeId(typeName), typeName);
    }

    private void put(String path, String body) {
        http.setLastResponse(RestAssured.given()
            .baseUri(http.baseUri())
            .contentType(ContentType.JSON)
            .body(body)
            .put(path));
    }

    private int ownerId(String fullName) {
        return http.idOf(ownerKey(fullName));
    }

    private int petId(String fullName, String petName) {
        return http.idOf(petKey(fullName, petName));
    }

    private Integer typeId(String typeName) {
        return jdbc.queryForObject("SELECT id FROM types WHERE name = ?", Integer.class, typeName);
    }

    private String ownerKey(String fullName) {
        return "owner:" + fullName;
    }

    private String petKey(String fullName, String petName) {
        return "pet:" + fullName + ":" + petName;
    }

    private String[] splitName(String fullName) {
        return fullName.split(" ", 2);
    }
}
