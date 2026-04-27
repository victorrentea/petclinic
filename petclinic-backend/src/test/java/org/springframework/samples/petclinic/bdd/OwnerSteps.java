package org.springframework.samples.petclinic.bdd;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import io.cucumber.java.Before;
import io.cucumber.java.en.And;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.samples.petclinic.model.Owner;
import org.springframework.samples.petclinic.model.Pet;
import org.springframework.samples.petclinic.model.PetType;
import org.springframework.samples.petclinic.repository.OwnerRepository;
import org.springframework.samples.petclinic.repository.PetRepository;
import org.springframework.samples.petclinic.repository.PetTypeRepository;
import org.springframework.samples.petclinic.rest.TestData;
import org.springframework.samples.petclinic.rest.dto.OwnerDto;
import org.springframework.samples.petclinic.rest.dto.PetDto;
import org.springframework.samples.petclinic.rest.dto.PetTypeDto;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.text.SimpleDateFormat;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Transactional
public class OwnerSteps {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    OwnerRepository ownerRepository;

    @Autowired
    PetRepository petRepository;

    @Autowired
    PetTypeRepository petTypeRepository;

    ObjectMapper mapper = new ObjectMapper()
        .registerModule(new JavaTimeModule())
        .setDateFormat(new SimpleDateFormat("yyyy-MM-dd"))
        .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    // scenario state
    int ownerId;
    int petId;
    PetType petType;
    MvcResult lastResult;

    @Before
    public void setup() {
        // reset state before each scenario
        ownerId = 0;
        petId = 0;
        petType = null;
        lastResult = null;
    }

    // ─── Background ───────────────────────────────────────────────────────────

    @Given("a owner {string} exists with address {string} city {string} telephone {string}")
    public void aOwnerExists(String fullName, String address, String city, String telephone) {
        String[] parts = fullName.split(" ", 2);
        Owner owner = TestData.anOwner();
        owner.setFirstName(parts[0]);
        owner.setLastName(parts[1]);
        owner.setAddress(address);
        owner.setCity(city);
        owner.setTelephone(telephone);
        owner = ownerRepository.save(owner);
        ownerId = owner.getId();
    }

    @And("that owner has a pet {string} of type {string}")
    public void ownerHasPet(String petName, String typeName) {
        petType = new PetType();
        petType.setName(typeName);
        petType = petTypeRepository.save(petType);

        Owner owner = ownerRepository.findById(ownerId).orElseThrow();
        Pet pet = new Pet();
        pet.setName(petName);
        pet.setBirthDate(LocalDate.now());
        pet.setOwner(owner);
        pet.setType(petType);
        pet = petRepository.save(pet);
        petId = pet.getId();
        owner.addPet(pet);
    }

    @Given("another owner {string} exists")
    public void anotherOwnerExists(String fullName) {
        String[] parts = fullName.split(" ", 2);
        Owner owner = TestData.anOwner();
        owner.setFirstName(parts[0]);
        owner.setLastName(parts[1]);
        ownerRepository.save(owner);
    }

    @Given("another owner {string} with address {string} exists")
    public void anotherOwnerWithAddressExists(String fullName, String address) {
        String[] parts = fullName.split(" ", 2);
        Owner owner = TestData.anOwner();
        owner.setFirstName(parts[0]);
        owner.setLastName(parts[1]);
        owner.setAddress(address);
        ownerRepository.save(owner);
    }

    // ─── GET by ID ────────────────────────────────────────────────────────────

    @When("I request the owner by ID")
    public void iRequestOwnerById() throws Exception {
        lastResult = mockMvc.perform(get("/api/owners/" + ownerId)).andReturn();
    }

    @When("I request owner with ID {int}")
    public void iRequestOwnerWithId(int id) throws Exception {
        lastResult = mockMvc.perform(get("/api/owners/" + id)).andReturn();
    }

    // ─── LIST / SEARCH ────────────────────────────────────────────────────────

    @When("I request all owners")
    public void iRequestAllOwners() throws Exception {
        lastResult = mockMvc.perform(get("/api/owners")).andReturn();
    }

    @When("I search owners with query {string}")
    public void iSearchOwners(String query) throws Exception {
        lastResult = mockMvc.perform(get("/api/owners?query=" + query)).andReturn();
    }

    // ─── CREATE owner ─────────────────────────────────────────────────────────

    @When("I create an owner with first name {string} last name {string} address {string} city {string} telephone {string}")
    public void iCreateOwner(String firstName, String lastName, String address, String city, String telephone)
        throws Exception {
        OwnerDto dto = new OwnerDto();
        dto.setFirstName(firstName);
        dto.setLastName(lastName);
        dto.setAddress(address);
        dto.setCity(city);
        dto.setTelephone(telephone);
        lastResult = mockMvc.perform(post("/api/owners")
            .content(mapper.writeValueAsString(dto))
            .contentType(MediaType.APPLICATION_JSON_VALUE)).andReturn();
    }

    @When("I create an owner without a first name last name {string} address {string} city {string} telephone {string}")
    public void iCreateOwnerWithoutFirstName(String lastName, String address, String city, String telephone)
        throws Exception {
        OwnerDto dto = new OwnerDto();
        dto.setLastName(lastName);
        dto.setAddress(address);
        dto.setCity(city);
        dto.setTelephone(telephone);
        lastResult = mockMvc.perform(post("/api/owners")
            .content(mapper.writeValueAsString(dto))
            .contentType(MediaType.APPLICATION_JSON_VALUE)).andReturn();
    }

    // ─── UPDATE owner ─────────────────────────────────────────────────────────

    @When("I update the owner setting first name to {string} with the owner ID in the body")
    public void iUpdateOwnerWithBodyId(String firstName) throws Exception {
        OwnerDto existing = getOwnerDto(ownerId);
        existing.setFirstName(firstName);
        lastResult = mockMvc.perform(put("/api/owners/" + ownerId)
            .content(mapper.writeValueAsString(existing))
            .contentType(MediaType.APPLICATION_JSON_VALUE)).andReturn();
    }

    @When("I update the owner setting first name to {string} without the owner ID in the body")
    public void iUpdateOwnerWithoutBodyId(String firstName) throws Exception {
        OwnerDto existing = getOwnerDto(ownerId);
        existing.setId(null);
        existing.setFirstName(firstName);
        lastResult = mockMvc.perform(put("/api/owners/" + ownerId)
            .content(mapper.writeValueAsString(existing))
            .contentType(MediaType.APPLICATION_JSON_VALUE)).andReturn();
    }

    @When("I update the owner setting first name to {string}")
    public void iUpdateOwnerFirstName(String firstName) throws Exception {
        OwnerDto existing = getOwnerDto(ownerId);
        existing.setFirstName(firstName);
        lastResult = mockMvc.perform(put("/api/owners/" + ownerId)
            .content(mapper.writeValueAsString(existing))
            .contentType(MediaType.APPLICATION_JSON_VALUE)).andReturn();
    }

    // ─── DELETE owner ─────────────────────────────────────────────────────────

    @When("I delete the owner")
    public void iDeleteOwner() throws Exception {
        lastResult = mockMvc.perform(delete("/api/owners/" + ownerId)).andReturn();
    }

    @When("I delete owner with ID {int}")
    public void iDeleteOwnerWithId(int id) throws Exception {
        lastResult = mockMvc.perform(delete("/api/owners/" + id)).andReturn();
    }

    // ─── CREATE pet ───────────────────────────────────────────────────────────

    @When("I add a pet named {string} of the existing type to the owner")
    public void iAddPet(String petName) throws Exception {
        PetDto dto = buildPetDto(petName);
        lastResult = mockMvc.perform(post("/api/owners/" + ownerId + "/pets")
            .content(mapper.writeValueAsString(dto))
            .contentType(MediaType.APPLICATION_JSON_VALUE)).andReturn();
    }

    @When("I add a pet without a name of the existing type to the owner")
    public void iAddPetWithoutName() throws Exception {
        PetDto dto = new PetDto();
        dto.setBirthDate(LocalDate.now());
        PetTypeDto typeDto = new PetTypeDto();
        typeDto.setId(petType.getId());
        typeDto.setName(petType.getName());
        dto.setType(typeDto);
        lastResult = mockMvc.perform(post("/api/owners/" + ownerId + "/pets")
            .content(mapper.writeValueAsString(dto))
            .contentType(MediaType.APPLICATION_JSON_VALUE)).andReturn();
    }

    // ─── GET owner's pet ──────────────────────────────────────────────────────

    @When("I request the owner's pet")
    public void iRequestOwnerPet() throws Exception {
        lastResult = mockMvc.perform(get("/api/owners/" + ownerId + "/pets/" + petId)).andReturn();
    }

    @When("I request pet of owner with ID {int}")
    public void iRequestPetOfOwnerWithId(int badOwnerId) throws Exception {
        lastResult = mockMvc.perform(get("/api/owners/" + badOwnerId + "/pets/" + petId)).andReturn();
    }

    @When("I request pet with ID {int} of the owner")
    public void iRequestPetWithIdOfOwner(int badPetId) throws Exception {
        lastResult = mockMvc.perform(get("/api/owners/" + ownerId + "/pets/" + badPetId)).andReturn();
    }

    // ─── UPDATE owner's pet ───────────────────────────────────────────────────

    @When("I update the owner's pet name to {string}")
    public void iUpdateOwnerPet(String newName) throws Exception {
        PetDto dto = buildPetDto(newName);
        dto.setId(petId);
        dto.setBirthDate(LocalDate.of(2020, 1, 15));
        lastResult = mockMvc.perform(put("/api/owners/" + ownerId + "/pets/" + petId)
            .content(mapper.writeValueAsString(dto))
            .contentType(MediaType.APPLICATION_JSON_VALUE)).andReturn();
    }

    @When("I update pet with owner ID {int} setting name to {string}")
    public void iUpdatePetWithBadOwnerId(int badOwnerId, String petName) throws Exception {
        PetDto dto = buildPetDto(petName);
        lastResult = mockMvc.perform(put("/api/owners/" + badOwnerId + "/pets/" + petId)
            .content(mapper.writeValueAsString(dto))
            .contentType(MediaType.APPLICATION_JSON_VALUE)).andReturn();
    }

    @When("I update pet with ID {int} of the owner setting name to {string}")
    public void iUpdatePetWithBadPetId(int badPetId, String petName) throws Exception {
        PetDto dto = buildPetDto(petName);
        dto.setBirthDate(LocalDate.of(2020, 1, 1));
        lastResult = mockMvc.perform(put("/api/owners/" + ownerId + "/pets/" + badPetId)
            .content(mapper.writeValueAsString(dto))
            .contentType(MediaType.APPLICATION_JSON_VALUE)).andReturn();
    }

    // ─── Assertions ───────────────────────────────────────────────────────────

    @Then("the response status is {int}")
    public void theResponseStatusIs(int statusCode) {
        assertThat(lastResult.getResponse().getStatus()).isEqualTo(statusCode);
    }

    @Then("the response status is 2xx")
    public void theResponseStatusIs2xx() {
        assertThat(lastResult.getResponse().getStatus()).isBetween(200, 299);
    }

    @Then("the response status is 4xx")
    public void theResponseStatusIs4xx() {
        assertThat(lastResult.getResponse().getStatus()).isBetween(400, 499);
    }

    @And("the response contains owner first name {string} and last name {string}")
    public void theResponseContainsOwner(String firstName, String lastName) throws Exception {
        OwnerDto dto = mapper.readValue(lastResult.getResponse().getContentAsString(), OwnerDto.class);
        assertThat(dto.getFirstName()).isEqualTo(firstName);
        assertThat(dto.getLastName()).isEqualTo(lastName);
    }

    @And("the owner list contains {string} {string}")
    public void ownerListContains(String firstName, String lastName) throws Exception {
        List<OwnerDto> owners = ownerList();
        assertThat(owners)
            .extracting(OwnerDto::getFirstName)
            .contains(firstName);
        assertThat(owners)
            .filteredOn(o -> firstName.equals(o.getFirstName()))
            .extracting(OwnerDto::getLastName)
            .contains(lastName);
    }

    @And("the owner list does not contain last name {string}")
    public void ownerListDoesNotContainLastName(String lastName) throws Exception {
        assertThat(ownerList())
            .extracting(OwnerDto::getLastName)
            .doesNotContain(lastName);
    }

    @And("the owner list is empty")
    public void ownerListIsEmpty() throws Exception {
        assertThat(ownerList()).isEmpty();
    }

    @And("the owner's first name is now {string}")
    public void theOwnerFirstNameIsNow(String firstName) throws Exception {
        OwnerDto updated = getOwnerDto(ownerId);
        assertThat(updated.getFirstName()).isEqualTo(firstName);
    }

    @And("requesting the owner by ID returns 404")
    public void requestingOwnerByIdReturns404() throws Exception {
        lastResult = mockMvc.perform(get("/api/owners/" + ownerId)).andReturn();
        assertThat(lastResult.getResponse().getStatus()).isEqualTo(404);
    }

    @And("the pet name is {string}")
    public void thePetNameIs(String name) throws Exception {
        PetDto dto = mapper.readValue(lastResult.getResponse().getContentAsString(), PetDto.class);
        assertThat(dto.getName()).isEqualTo(name);
    }

    @And("the owner has {int} pet")
    public void theOwnerHas(int count) throws Exception {
        OwnerDto dto = mapper.readValue(lastResult.getResponse().getContentAsString(), OwnerDto.class);
        assertThat(dto.getPets()).hasSize(count);
    }

    @And("the first pet is named {string} with type {string}")
    public void theFirstPetIsNamedWithType(String petName, String typeName) throws Exception {
        OwnerDto dto = mapper.readValue(lastResult.getResponse().getContentAsString(), OwnerDto.class);
        assertThat(dto.getPets().get(0).getName()).isEqualTo(petName);
        assertThat(dto.getPets().get(0).getType()).isNotNull();
        assertThat(dto.getPets().get(0).getType().getName()).isEqualTo(typeName);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private OwnerDto getOwnerDto(int id) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/owners/" + id))
            .andExpect(status().isOk())
            .andReturn();
        return mapper.readValue(result.getResponse().getContentAsString(), OwnerDto.class);
    }

    private List<OwnerDto> ownerList() throws Exception {
        return mapper.readValue(lastResult.getResponse().getContentAsString(),
            new TypeReference<List<OwnerDto>>() {});
    }

    private PetDto buildPetDto(String name) {
        PetDto dto = new PetDto();
        dto.setName(name);
        dto.setBirthDate(LocalDate.now());
        PetTypeDto typeDto = new PetTypeDto();
        typeDto.setId(petType.getId());
        typeDto.setName(petType.getName());
        dto.setType(typeDto);
        return dto;
    }
}

