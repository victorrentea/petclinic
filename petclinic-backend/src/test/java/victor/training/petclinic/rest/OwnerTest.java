package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.text.SimpleDateFormat;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;
import java.util.stream.StreamSupport;

import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.PetType;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.PetTypeRepository;
import victor.training.petclinic.rest.dto.OwnerDto;
import victor.training.petclinic.rest.dto.PetDto;
import victor.training.petclinic.rest.dto.PetTypeDto;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import jakarta.transaction.Transactional;

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
public class OwnerTest {

    @Autowired
    MockMvc mockMvc;

    ObjectMapper mapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .setDateFormat(new SimpleDateFormat("yyyy-MM-dd"))
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    @Autowired
    OwnerRepository ownerRepository;

    @Autowired
    PetRepository petRepository;

    @Autowired
    PetTypeRepository petTypeRepository;

    int ownerId;
    int petId;
    PetType petType;

    @BeforeEach
    final void before() {
        Owner owner = TestData.anOwner();
        owner.setFirstName("George");
        owner.setLastName("Franklin");
        owner = ownerRepository.save(owner);
        ownerId = owner.getId();

        petType = new PetType();
        petType.setName("dog");
        petType = petTypeRepository.save(petType);

        Pet pet = new Pet();
        pet.setName("Rosy");
        pet.setBirthDate(LocalDate.now());
        pet.setOwner(owner);
        pet.setType(petType);
        pet = petRepository.save(pet);
        petId = pet.getId();

        // Add pet to owner's collection for bidirectional relationship
        owner.addPet(pet);
    }

    private OwnerDto callGet(int ownerId) throws Exception {
        String responseJson = mockMvc.perform(get("/api/owners/" + ownerId))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json"))
                .andReturn()
                .getResponse()
                .getContentAsString();
        return mapper.readValue(responseJson, OwnerDto.class);
    }

    @Test
    void getByIdOk() throws Exception {
        OwnerDto responseDto = callGet(ownerId);

        assertThat(responseDto.getId()).isEqualTo(ownerId);
        assertThat(responseDto.getFirstName()).isEqualTo("George");
        assertThat(responseDto.getLastName()).isEqualTo("Franklin");
    }

    @Test
    void getById_notFound() throws Exception {
        mockMvc.perform(get("/api/owners/99999"))
                .andExpect(status().isNotFound());
    }

    @Test
    void count_returnsOwnerCount() throws Exception {
        long before = ownerRepository.count();

        mockMvc.perform(get("/api/owners/count"))
                .andExpect(status().isOk())
                .andExpect(content().string(String.valueOf(before)));
    }

    @Test
    void getAll() throws Exception {
        List<OwnerDto> owners = search("/api/owners");

        assertThat(owners)
                .extracting(OwnerDto::getId, OwnerDto::getFirstName, OwnerDto::getLastName)
                .contains(Assertions.tuple(ownerId, "George", "Franklin"));
    }

    @Test
    void getAllWithAddressFilter() throws Exception {
        Owner owner2 = TestData.anOwner();
        owner2.setLastName("JavaBeans");
        int owner2Id = ownerRepository.save(owner2).getId();

        List<OwnerDto> owners = search("/api/owners?lastName=Java");

        assertThat(owners)
                .extracting(OwnerDto::getId, OwnerDto::getLastName)
                .contains(Assertions.tuple(owner2Id, "JavaBeans"));
    }

    private List<OwnerDto> search(String uriTemplate) throws Exception {
        JsonNode page = mapper.readTree(mockMvc.perform(get(uriTemplate))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json"))
                .andReturn()
                .getResponse()
                .getContentAsString());
        return mapper.convertValue(page.path("content"), new TypeReference<List<OwnerDto>>() {
        });
    }

    @Test
    void getAllWithNameFilter_notFound() throws Exception {
        List<OwnerDto> results = search("/api/owners?lastName=NonExistent");

        assertThat(results).isEmpty();
    }

    @Test
    void update_ok() throws Exception {
        OwnerDto existing = callGet(ownerId);
        existing.setFirstName("GeorgeI");

        mockMvc.perform(put("/api/owners/" + ownerId)
                .content(mapper.writeValueAsString(existing))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().is2xxSuccessful());

        // assert the update took place
        OwnerDto updated = callGet(ownerId);
        assertThat(updated.getFirstName()).isEqualTo("GeorgeI");
    }

    @Test
    void update_okNoBodyId() throws Exception {
        OwnerDto existing = callGet(ownerId);
        existing.setId(null); // Test without body ID
        existing.setFirstName("GeorgeII");

        mockMvc.perform(put("/api/owners/" + ownerId)
                .content(mapper.writeValueAsString(existing))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().is2xxSuccessful());

        // assert the update took place
        OwnerDto updated = callGet(ownerId);
        assertThat(updated.getFirstName()).isEqualTo("GeorgeII");
    }

    @Test
    void update_invalid() throws Exception {
        OwnerDto existing = callGet(ownerId);
        existing.setFirstName(""); // invalid firstName

        mockMvc.perform(put("/api/owners/" + ownerId)
                .content(mapper.writeValueAsString(existing))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void delete_ok() throws Exception {
        mockMvc.perform(delete("/api/owners/" + ownerId))
                .andExpect(status().is2xxSuccessful());

        mockMvc.perform(get("/api/owners/" + ownerId))
                .andExpect(status().isNotFound());
    }

    @Test
    void delete_notFound() throws Exception {
        mockMvc.perform(delete("/api/owners/9999"))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void createPet_invalid() throws Exception {
        PetTypeDto typeDto = new PetTypeDto()
                .setId(petType.getId())
                .setName(petType.getName());
        // missing name - validation error
        PetDto newPet = new PetDto()
                .setBirthDate(LocalDate.now())
                .setType(typeDto);

        mockMvc.perform(post("/api/owners/" + ownerId + "/pets")
                .content(mapper.writeValueAsString(newPet))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().isBadRequest());
    }

    @Test
    void getOwnerPet_ok() throws Exception {
        mockMvc.perform(get("/api/owners/" + ownerId + "/pets/" + petId))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json"))
                .andExpect(jsonPath("$.id").value(petId))
                .andExpect(jsonPath("$.name").value("Rosy"));
    }

    @Test
    void getOwnerPet_ownerNotFound() throws Exception {
        mockMvc.perform(get("/api/owners/99999/pets/" + petId))
                .andExpect(status().isNotFound());
    }

    @Test
    void getOwnerPet_petNotFound() throws Exception {
        mockMvc.perform(get("/api/owners/" + ownerId + "/pets/99999"))
                .andExpect(status().isNotFound());
    }

    @Test
    void updateOwnerPet_ok() throws Exception {
        PetTypeDto typeDto = new PetTypeDto()
                .setId(petType.getId())
                .setName(petType.getName());
        PetDto petDto = new PetDto()
                .setId(petId)
                .setName("Rosy Updated")
                .setBirthDate(LocalDate.of(2020, 1, 15))
                .setType(typeDto);

        mockMvc.perform(put("/api/owners/" + ownerId + "/pets/" + petId)
                .content(mapper.writeValueAsString(petDto))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().is2xxSuccessful());
    }

    @Test
    void updateOwnerPet_ownerNotFound() throws Exception {
        PetTypeDto typeDto = new PetTypeDto()
                .setId(petType.getId())
                .setName(petType.getName());
        PetDto petDto = new PetDto()
                .setName("Thor")
                .setBirthDate(LocalDate.now())
                .setType(typeDto);

        mockMvc.perform(put("/api/owners/99999/pets/" + petId)
                .content(mapper.writeValueAsString(petDto))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().is2xxSuccessful());
    }

    @Test
    void updateOwnerPet_petNotFound() throws Exception {
        PetTypeDto typeDto = new PetTypeDto()
                .setId(petType.getId())
                .setName(petType.getName());
        PetDto petDto = new PetDto()
                .setName("Ghost")
                .setBirthDate(LocalDate.of(2020, 1, 1))
                .setType(typeDto);

        mockMvc.perform(put("/api/owners/" + ownerId + "/pets/99999")
                .content(mapper.writeValueAsString(petDto))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().isNotFound());
    }

    // ── GET /api/owners: paged, sorted, filtered (spec owner-listing) ──────────────────────

    @Test
    void list_defaultsToTheFirstPageOfTen() throws Exception {
        givenOwnerCount(12);

        JsonNode page = list("");

        assertThat(page.path("content")).hasSize(10);
        assertThat(page.path("page").asInt()).isZero();
        assertThat(page.path("size").asInt()).isEqualTo(10);
        assertThat(page.path("totalElements").asLong()).isEqualTo(12);
    }

    @Test
    void list_lastPartialPage() throws Exception {
        givenOwnerCount(12);

        JsonNode page = list("?page=1&size=10");

        assertThat(page.path("content")).hasSize(2);
        assertThat(page.path("totalElements").asLong()).isEqualTo(12);
    }

    @Test
    void list_pageBeyondTheEnd_isEmptyWithTheTrueTotal() throws Exception {
        givenOwnerCount(12);

        JsonNode page = list("?page=5&size=10");

        assertThat(page.path("content")).isEmpty();
        assertThat(page.path("totalElements").asLong()).isEqualTo(12);
    }

    @Test
    void list_includesThePets() throws Exception {
        JsonNode page = list("?lastName=Franklin");

        assertThat(page.path("content").get(0).path("pets").get(0).path("name").asText()).isEqualTo("Rosy");
    }

    @Test
    void list_allowedSize() throws Exception {
        givenOwnerCount(30);

        assertThat(list("?size=20").path("content")).hasSize(20);
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "size | 1000", "size | 0", "size | abc",
            "size | 7", "page | -1", "page | abc", "page | 107374183",
            "sort | telephone,asc", "sort | name", "sort | name,up", "sort | name;drop table owners"})
    void list_rejectsAnInvalidParameter(String name, String value) throws Exception {
        long ownersBefore = ownerRepository.count();

        mockMvc.perform(get("/api/owners").param(name, value))
                .andExpect(status().isBadRequest());

        assertThat(ownerRepository.count()).isEqualTo(ownersBefore);
    }

    @Test
    void list_sortByName_breaksTiesOnFirstNameThenId() throws Exception {
        int harry1 = givenOwner("Harry", "Potter", "London");
        int beatrix = givenOwner("Beatrix", "Potter", "London");
        int harry2 = givenOwner("Harry", "Potter", "London");

        assertThat(ids(list("?lastName=Potter&sort=name,asc"))).containsExactly(beatrix, harry1, harry2);
    }

    @Test
    void list_sortByNameDesc_isTheExactReverseOfAsc() throws Exception {
        givenOwnersSharingCitiesAndNames();

        List<Integer> asc = ids(list("?size=20&sort=name,asc"));
        List<Integer> desc = ids(list("?size=20&sort=name,desc"));

        assertThat(desc).containsExactlyElementsOf(asc.reversed());
    }

    @Test
    void list_sortByCity_groupsTheCityThenOrdersByName() throws Exception {
        givenOwner("Zed", "Aardvark", "Paris");
        givenOwner("Harry", "Potter", "London");
        givenOwner("Beatrix", "Potter", "London");
        givenOwner("Ann", "Brown", "London");

        JsonNode page = list("?sort=city,asc");

        assertThat(fullNamesIn(page)).containsExactly(
                "Ann Brown", "George Franklin", "Beatrix Potter", "Harry Potter", "Zed Aardvark");
    }

    @Test
    void list_walkingAllPages_showsEveryOwnerExactlyOnce() throws Exception {
        givenOwnersSharingCitiesAndNames();
        List<Integer> seen = new ArrayList<>();

        for (int page = 0; page * 5 < ownerRepository.count(); page++) {
            seen.addAll(ids(list("?size=5&sort=city,asc&page=" + page)));
        }

        assertThat(seen).doesNotHaveDuplicates().hasSize((int) ownerRepository.count());
    }

    @Test
    void list_sortByName_isAccentAware() throws Exception {
        givenOwner("Newt", "Wensleydale", "Leeds");
        givenOwner("Jan", "Śliwiński", "Kraków");
        givenOwner("Newt", "Scamander", "London");

        assertThat(lastNamesIn(list("?size=20&sort=name,asc")))
                .containsSubsequence("Scamander", "Śliwiński", "Wensleydale");
    }

    @Test
    void list_sortByName_placesACommaBelowBesideItsBaseLetter() throws Exception {
        givenOwner("Ion", "Muresby", "Cluj");
        givenOwner("Ana", "Mureșan", "Cluj");

        assertThat(lastNamesIn(list("?lastName=Mure"))).containsExactly("Mureșan", "Muresby");
    }

    @Test
    void list_filterByLastName_countsOnlyTheMatches() throws Exception {
        givenOwnerCount(10);
        givenOwner("Harry", "Potter", "London");
        givenOwner("Lily", "Potter", "London");

        JsonNode page = list("?lastName=Pot");

        assertThat(lastNamesIn(page)).containsExactly("Potter", "Potter");
        assertThat(page.path("totalElements").asLong()).isEqualTo(2);
    }

    @Test
    void list_filterByLastName_isCaseSensitive() throws Exception {
        givenOwner("Harry", "Potter", "London");

        JsonNode page = list("?lastName=pot");

        assertThat(page.path("content")).isEmpty();
        assertThat(page.path("totalElements").asLong()).isZero();
    }

    private JsonNode list(String query) throws Exception {
        return mapper.readTree(mockMvc.perform(get("/api/owners" + query))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }

    private int givenOwner(String firstName, String lastName, String city) {
        Owner owner = TestData.anOwner();
        owner.setFirstName(firstName);
        owner.setLastName(lastName);
        owner.setCity(city);
        return ownerRepository.save(owner).getId();
    }

    private void givenOwnerCount(int total) {
        while (ownerRepository.count() < total) {
            givenOwner("First", "Last" + ownerRepository.count(), "City");
        }
    }

    private void givenOwnersSharingCitiesAndNames() {
        String[] cities = {"London", "Paris", "London", "Rome"};
        for (int i = 0; i < 12; i++) {
            givenOwner(i % 2 == 0 ? "Harry" : "Lily", i % 3 == 0 ? "Potter" : "Evans", cities[i % cities.length]);
        }
    }

    private static List<Integer> ids(JsonNode page) {
        return values(page, owner -> owner.path("id").asInt());
    }

    private static List<String> lastNamesIn(JsonNode page) {
        return values(page, owner -> owner.path("lastName").asText());
    }

    private static List<String> fullNamesIn(JsonNode page) {
        return values(page, owner -> owner.path("firstName").asText() + " " + owner.path("lastName").asText());
    }

    private static <T> List<T> values(JsonNode page, Function<JsonNode, T> field) {
        return StreamSupport.stream(page.path("content").spliterator(), false).map(field).toList();
    }
}
