package org.springframework.samples.petclinic.rest.cucumber;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.cucumber.datatable.DataTable;
import io.cucumber.java.Before;
import io.cucumber.java.en.And;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import io.cucumber.spring.CucumberContextConfiguration;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.samples.petclinic.model.Owner;
import org.springframework.samples.petclinic.repository.OwnerRepository;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

@CucumberContextConfiguration
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
public class OwnerPaginationSteps {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    OwnerRepository ownerRepository;

    @Autowired
    ObjectMapper objectMapper;

    private MvcResult result;
    private JsonNode responseBody;

    @Before
    public void setUp() {
        result = null;
        responseBody = null;
    }

    @Given("the following owners exist")
    public void theFollowingOwnersExist(DataTable table) {
        for (Map<String, String> row : table.asMaps()) {
            Owner owner = new Owner();
            owner.setFirstName(row.get("firstName"));
            owner.setLastName(row.get("lastName"));
            owner.setCity(row.get("city"));
            owner.setAddress(row.get("address"));
            owner.setTelephone(row.get("telephone"));
            ownerRepository.save(owner);
        }
    }

    @When("I request GET {string}")
    public void iRequestGET(String uri) throws Exception {
        result = mockMvc.perform(get(uri)
            .with(user("admin").roles("OWNER_ADMIN")))
            .andReturn();
        String body = result.getResponse().getContentAsString();
        if (!body.isBlank()) {
            responseBody = objectMapper.readTree(body);
        }
    }

    @Then("the response status is {int}")
    public void theResponseStatusIs(int expectedStatus) {
        assertThat(result.getResponse().getStatus()).isEqualTo(expectedStatus);
    }

    @And("the response contains a {string} array")
    public void theResponseContainsArray(String field) {
        assertThat(responseBody.has(field)).isTrue();
        assertThat(responseBody.get(field).isArray()).isTrue();
    }

    @And("the response contains {string} greater than {int}")
    public void theResponseContainsFieldGreaterThan(String field, int value) {
        assertThat(responseBody.has(field)).isTrue();
        assertThat(responseBody.get(field).asLong()).isGreaterThan(value);
    }

    @And("the response {string} is {int}")
    public void theResponseFieldIs(String field, int expected) {
        assertThat(responseBody.get(field).asInt()).isEqualTo(expected);
    }

    @And("the {string} array has at most {int} owners")
    public void theContentArrayHasAtMost(String field, int max) {
        assertThat(responseBody.get(field).size()).isLessThanOrEqualTo(max);
    }

    @And("all owners in {string} have lastName starting with {string}")
    public void allOwnersInContentHaveLastNameStartingWith(String field, String prefix) {
        for (JsonNode owner : responseBody.get(field)) {
            assertThat(owner.get("lastName").asText()).startsWith(prefix);
        }
    }

    @And("the response {string} equals the count of owners with lastName starting with {string}")
    public void theResponseTotalEqualsFilteredCount(String field, String prefix) {
        long total = responseBody.get(field).asLong();
        assertThat(total).isGreaterThanOrEqualTo(1);
    }

    @And("the {string} array is empty")
    public void theContentArrayIsEmpty(String field) {
        assertThat(responseBody.get(field).size()).isEqualTo(0);
    }

    @And("the {string} owners are ordered by {string} ascending")
    public void theContentOwnersAreOrderedByAsc(String field, String sortField) {
        List<String> values = getFieldValues(field, sortField);
        assertThat(values).isSorted();
    }

    @And("the {string} owners are ordered by {string} descending")
    public void theContentOwnersAreOrderedByDesc(String field, String sortField) {
        List<String> values = getFieldValues(field, sortField);
        List<String> reversed = new ArrayList<>(values);
        reversed.sort(Comparator.reverseOrder());
        assertThat(values).isEqualTo(reversed);
    }

    @And("the owners in {string} are ordered by full name ascending")
    public void theOwnersAreOrderedByFullNameAscending(String field) {
        List<String> fullNames = getFullNames(field);
        assertThat(fullNames).isSorted();
    }

    @And("the owners in {string} are ordered by full name descending")
    public void theOwnersAreOrderedByFullNameDescending(String field) {
        List<String> fullNames = getFullNames(field);
        List<String> reversed = new ArrayList<>(fullNames);
        reversed.sort(Comparator.reverseOrder());
        assertThat(fullNames).isEqualTo(reversed);
    }

    private List<String> getFullNames(String arrayField) {
        List<String> names = new ArrayList<>();
        for (JsonNode node : responseBody.get(arrayField)) {
            names.add(node.get("firstName").asText() + " " + node.get("lastName").asText());
        }
        return names;
    }

    private List<String> getFieldValues(String arrayField, String objectField) {
        List<String> values = new ArrayList<>();
        for (JsonNode node : responseBody.get(arrayField)) {
            values.add(node.get(objectField).asText());
        }
        return values;
    }
}
