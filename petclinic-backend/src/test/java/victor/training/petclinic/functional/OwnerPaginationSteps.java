package victor.training.petclinic.functional;

import io.cucumber.java.en.Then;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

public class OwnerPaginationSteps {

    @Autowired
    private HttpContext http;

    @Then("the response contains fields {string}, {string}, {string}, {string}, {string}")
    public void theResponseContainsFields(String f1, String f2, String f3, String f4, String f5) {
        var jp = http.getLastResponse().jsonPath();
        for (String field : List.of(f1, f2, f3, f4, f5)) {
            assertThat((Object) jp.get(field)).as("response should contain field '%s'", field).isNotNull();
        }
    }

    @Then("the response field {string} equals {int}")
    public void theResponseFieldEqualsInt(String field, int expected) {
        assertThat(http.getLastResponse().jsonPath().getInt(field)).isEqualTo(expected);
    }

    @Then("the response field {string} has {int} items")
    public void theResponseFieldHasNItems(String field, int expected) {
        assertThat(http.getLastResponse().jsonPath().getList(field)).hasSize(expected);
    }

    @Then("the response field {string} has at most {int} items")
    public void theResponseFieldHasAtMostNItems(String field, int max) {
        assertThat(http.getLastResponse().jsonPath().getList(field)).hasSizeLessThanOrEqualTo(max);
    }

    @Then("the response field {string} is sorted by {string} ascending")
    public void theResponseFieldIsSortedAscending(String arrayField, String sortField) {
        List<String> values = http.getLastResponse().jsonPath()
            .getList(arrayField + "." + sortField, String.class);
        assertThat(values).isSortedAccordingTo(String::compareToIgnoreCase);
    }

    @Then("the response field {string} is sorted by {string} descending")
    public void theResponseFieldIsSortedDescending(String arrayField, String sortField) {
        List<String> values = http.getLastResponse().jsonPath()
            .getList(arrayField + "." + sortField, String.class);
        assertThat(values).isSortedAccordingTo((a, b) -> b.compareToIgnoreCase(a));
    }

    @Then("every item in {string} has {string} starting with {string}")
    public void everyItemInArrayHasFieldStartingWith(String arrayField, String itemField, String prefix) {
        List<String> values = http.getLastResponse().jsonPath()
            .getList(arrayField + "." + itemField, String.class);
        assertThat(values).isNotEmpty().allMatch(v -> v.startsWith(prefix));
    }
}
