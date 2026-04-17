package org.springframework.samples.petclinic.rest.cucumber;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.cucumber.java.After;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.samples.petclinic.model.Owner;
import org.springframework.samples.petclinic.repository.OwnerRepository;
import org.springframework.samples.petclinic.rest.TestData;
import org.springframework.samples.petclinic.rest.dto.OwnerDto;
import org.springframework.test.web.servlet.MockMvc;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

public class OwnerSteps {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper mapper;
    @Autowired OwnerRepository ownerRepository;

    // --- scenario state ---
    private MockHttpServletResponse lastResponse;
    private Integer lastOwnerId;
    private List<OwnerDto> lastResults;
    private OwnerPageResult lastPage;
    private final List<Integer> toDelete = new ArrayList<>();

    @After
    public void cleanup() {
        toDelete.forEach(id -> ownerRepository.findById(id).ifPresent(ownerRepository::delete));
        toDelete.clear();
        lastOwnerId = null;
        lastResults = null;
        lastPage = null;
    }

    // ── Given ────────────────────────────────────────────────────────────────

    @Given("owner {string} is registered")
    public void ownerIsRegistered(String fullName) {
        String[] parts = fullName.split(" ", 2);
        lastOwnerId = save(TestData.anOwner().setFirstName(parts[0]).setLastName(parts[1]));
    }

    @Given("owner with last name {string} is registered")
    public void ownerWithLastNameIsRegistered(String lastName) {
        lastOwnerId = save(TestData.anOwner().setLastName(lastName));
    }

    @Given("owner {string} lives at {string} in {string}")
    public void ownerLivesAt(String fullName, String address, String city) {
        String[] parts = fullName.split(" ", 2);
        lastOwnerId = save(TestData.anOwner()
            .setFirstName(parts[0]).setLastName(parts[1])
            .setAddress(address).setCity(city));
    }

    // ── When ─────────────────────────────────────────────────────────────────

    @When("I look up that owner")
    public void iLookUpThatOwner() throws Exception {
        lastResponse = doGet("/api/owners/" + lastOwnerId);
    }

    @When("I look up owner with ID {int}")
    public void iLookUpOwnerWithId(int id) throws Exception {
        lastResponse = doGet("/api/owners/" + id);
    }

    @When("I search owners for {string}")
    public void iSearchOwnersFor(String query) throws Exception {
        String json = doGetJson("/api/owners?q=" + query + "&size=1000");
        lastPage = mapper.readValue(json, OwnerPageResult.class);
        lastResults = lastPage.content;
    }

    @When("I search owners for {string} page {int} size {int}")
    public void iSearchOwnersForWithPage(String query, int page, int size) throws Exception {
        String json = doGetJson("/api/owners?q=" + query + "&page=" + page + "&size=" + size);
        lastPage = mapper.readValue(json, OwnerPageResult.class);
        lastResults = lastPage.content;
    }

    @When("I register owner {string} {string} at {string} in {string} tel {string}")
    public void iRegisterOwner(String first, String last, String address, String city, String tel) throws Exception {
        OwnerDto dto = new OwnerDto()
            .setFirstName(first.isEmpty() ? null : first)
            .setLastName(last).setAddress(address).setCity(city).setTelephone(tel);
        lastResponse = doPost("/api/owners", dto);
    }

    @When("I rename that owner to {string} {string}")
    public void iRenameThatOwner(String first, String last) throws Exception {
        String json = doGetJson("/api/owners/" + lastOwnerId);
        OwnerDto dto = mapper.readValue(json, OwnerDto.class);
        dto.setFirstName(first).setLastName(last);
        lastResponse = doPut("/api/owners/" + lastOwnerId, dto);
    }

    @When("I delete that owner")
    public void iDeleteThatOwner() throws Exception {
        lastResponse = doDelete("/api/owners/" + lastOwnerId);
        toDelete.remove(lastOwnerId);   // already gone, no need to cleanup
    }

    @When("I list owners page {int} size {int}")
    public void iListOwners(int page, int size) throws Exception {
        lastResponse = doGet("/api/owners?page=" + page + "&size=" + size);
        lastPage = mapper.readValue(lastResponse.getContentAsString(), OwnerPageResult.class);
        lastResults = lastPage.content;
    }

    @When("I list owners page {int} size {int} sorted by {string} asc")
    public void iListOwnersSorted(int page, int size, String sortField) throws Exception {
        String url = "/api/owners?page=" + page + "&size=" + size + "&sort=" + sortField + ",asc";
        lastResponse = doGet(url);
        if (lastResponse.getStatus() == 200) {
            lastPage = mapper.readValue(lastResponse.getContentAsString(), OwnerPageResult.class);
            lastResults = lastPage.content;
        }
    }


    @Then("the response status is {int}")
    public void theResponseStatusIs(int expected) {
        assertThat(lastResponse.getStatus()).isEqualTo(expected);
    }

    @Then("the owner name is {string} {string}")
    public void theOwnerNameIs(String first, String last) throws Exception {
        OwnerDto dto = mapper.readValue(lastResponse.getContentAsString(), OwnerDto.class);
        assertThat(dto.getFirstName()).isEqualTo(first);
        assertThat(dto.getLastName()).isEqualTo(last);
    }

    @Then("{string} is in the results")
    public void isInResults(String fullName) {
        String[] parts = fullName.split(" ", 2);
        assertThat(lastResults)
            .anySatisfy(o -> {
                assertThat(o.getFirstName()).isEqualTo(parts[0]);
                assertThat(o.getLastName()).isEqualTo(parts[1]);
            });
    }

    @Then("{string} is not in the results")
    public void isNotInResults(String fullName) {
        String[] parts = fullName.split(" ", 2);
        assertThat(lastResults)
            .noneSatisfy(o -> {
                assertThat(o.getFirstName()).isEqualTo(parts[0]);
                assertThat(o.getLastName()).isEqualTo(parts[1]);
            });
    }

    @Then("the results are empty")
    public void theResultsAreEmpty() {
        assertThat(lastResults).isEmpty();
    }

    @Then("looking up that owner shows {string} {string}")
    public void lookingUpThatOwnerShows(String first, String last) throws Exception {
        String json = doGetJson("/api/owners/" + lastOwnerId);
        OwnerDto dto = mapper.readValue(json, OwnerDto.class);
        assertThat(dto.getFirstName()).isEqualTo(first);
        assertThat(dto.getLastName()).isEqualTo(last);
    }

    @Then("looking up that owner returns {int}")
    public void lookingUpThatOwnerReturns(int expectedStatus) throws Exception {
        int actual = doGet("/api/owners/" + lastOwnerId).getStatus();
        assertThat(actual).isEqualTo(expectedStatus);
    }

    @Then("the page metadata shows number {int} and size {int}")
    public void thePageMetadataShows(int number, int size) {
        assertThat(lastPage.number).isEqualTo(number);
        assertThat(lastPage.size).isEqualTo(size);
    }

    @Then("totalElements is at least {int}")
    public void totalElementsAtLeast(int min) {
        assertThat(lastPage.totalElements).isGreaterThanOrEqualTo(min);
    }

    @Then("totalElements is {int}")
    public void totalElementsIs(int expected) {
        assertThat(lastPage.totalElements).isEqualTo(expected);
    }

    @Then("the results contain {int} owners")
    public void theResultsContain(int count) {
        assertThat(lastResults).hasSize(count);
    }

    @Then("the owners are in ascending first-name order")
    public void ownersAreInAscendingFirstNameOrder() {
        List<String> names = lastResults.stream().map(OwnerDto::getFirstName).toList();
        assertThat(names).isSortedAccordingTo(String.CASE_INSENSITIVE_ORDER);
    }

    @Then("the actual page size is at most {int}")
    public void actualPageSizeAtMost(int max) {
        assertThat(lastPage.size).isLessThanOrEqualTo(max);
    }

    // ── HTTP helpers ──────────────────────────────────────────────────────────

    private MockHttpServletResponse doGet(String url) throws Exception {
        return mockMvc.perform(get(url).with(ownerAdmin()))
            .andReturn().getResponse();
    }

    private String doGetJson(String url) throws Exception {
        return mockMvc.perform(get(url).with(ownerAdmin()))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
    }

    private MockHttpServletResponse doPost(String url, Object body) throws Exception {
        return mockMvc.perform(post(url).with(ownerAdmin())
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(body)))
            .andReturn().getResponse();
    }

    private MockHttpServletResponse doPut(String url, Object body) throws Exception {
        return mockMvc.perform(put(url).with(ownerAdmin())
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(body)))
            .andReturn().getResponse();
    }

    private MockHttpServletResponse doDelete(String url) throws Exception {
        return mockMvc.perform(delete(url).with(ownerAdmin()))
            .andReturn().getResponse();
    }

    private static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.UserRequestPostProcessor ownerAdmin() {
        return user("admin").roles("OWNER_ADMIN");
    }

    private int save(Owner owner) {
        int id = ownerRepository.save(owner).getId();
        toDelete.add(id);
        return id;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class OwnerPageResult {
        public List<OwnerDto> content;
        public long totalElements;
        public int totalPages;
        public int number;
        public int size;
    }
}

