package victor.training.petclinic.functional;

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
