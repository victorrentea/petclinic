package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.text.SimpleDateFormat;
import java.time.LocalDate;
import java.util.List;

import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
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
        String responseJson = mockMvc.perform(get(uriTemplate))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json"))
                .andReturn()
                .getResponse()
                .getContentAsString();

        return mapper.readValue(mapper.readTree(responseJson).get("content").toString(),
                new TypeReference<List<OwnerDto>>() {
                });
    }

    @Test
    void getAllWithNameFilter_notFound() throws Exception {
        List<OwnerDto> results = search("/api/owners?lastName=NonExistent");

        assertThat(results).isEmpty();
    }

    private int saveOwner(String firstName, String lastName, String city) {
        Owner owner = TestData.anOwner();
        owner.setFirstName(firstName);
        owner.setLastName(lastName);
        owner.setCity(city);
        return ownerRepository.save(owner).getId();
    }

    private List<String> citiesSortedBy(String sort) throws Exception {
        return search("/api/owners?size=20&sort=" + sort).stream().map(OwnerDto::getCity).toList();
    }

    private void saveOwnersNamed(String firstNamePrefix, int count) {
        for (int i = 1; i <= count; i++) {
            saveOwner("%s%02d".formatted(firstNamePrefix, i), "Smith", "London");
        }
    }

    @Test
    void list_defaultPage() throws Exception {
        saveOwnersNamed("A", 11); // + George = 12 owners

        mockMvc.perform(get("/api/owners"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(10))
                .andExpect(jsonPath("$.content[0].firstName").value("A01"))
                .andExpect(jsonPath("$.content[9].firstName").value("A10"))
                .andExpect(jsonPath("$.number").value(0))
                .andExpect(jsonPath("$.size").value(10))
                .andExpect(jsonPath("$.totalElements").value(12))
                .andExpect(jsonPath("$.totalPages").value(2));
    }

    @Test
    void list_requestedPage() throws Exception {
        saveOwnersNamed("A", 11); // + George = 12 owners

        mockMvc.perform(get("/api/owners?page=1&size=5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(5))
                .andExpect(jsonPath("$.content[0].firstName").value("A06"))
                .andExpect(jsonPath("$.content[4].firstName").value("A10"))
                .andExpect(jsonPath("$.number").value(1))
                .andExpect(jsonPath("$.size").value(5))
                .andExpect(jsonPath("$.totalElements").value(12))
                .andExpect(jsonPath("$.totalPages").value(3));
    }

    @Test
    void list_pageBeyondTheEnd() throws Exception {
        saveOwnersNamed("A", 11); // + George = 12 owners

        mockMvc.perform(get("/api/owners?page=7&size=5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0))
                .andExpect(jsonPath("$.totalElements").value(12))
                .andExpect(jsonPath("$.totalPages").value(3));
    }

    @Test
    void list_lastNameFilterCombinedWithPaging() throws Exception {
        for (int i = 1; i <= 7; i++) {
            saveOwner("Mc%d".formatted(i), "McDonald", "London");
        }

        mockMvc.perform(get("/api/owners?lastName=Mc&size=5&page=1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.totalElements").value(7))
                .andExpect(jsonPath("$.totalPages").value(2));
    }

    @Test
    void list_sortByCityDescending() throws Exception {
        saveOwner("Ann", "Smith", "Berlin");
        saveOwner("Bob", "Smith", "Paris");

        assertThat(citiesSortedBy("city,desc")).containsExactly("Paris", "London", "Berlin");
    }

    @Test
    void list_sortByCityTiesBrokenByName() throws Exception {
        saveOwner("Zed", "Smith", "Winnetka");
        saveOwner("Amy", "Smith", "Winnetka");
        saveOwner("Amy", "Jones", "Winnetka");

        assertThat(search("/api/owners?size=20&sort=city,asc"))
                .extracting(OwnerDto::getCity, OwnerDto::getFirstName, OwnerDto::getLastName)
                .containsExactly(
                        Assertions.tuple("London", "George", "Franklin"),
                        Assertions.tuple("Winnetka", "Amy", "Jones"),
                        Assertions.tuple("Winnetka", "Amy", "Smith"),
                        Assertions.tuple("Winnetka", "Zed", "Smith"));
    }

    @Test
    void list_ownersSharingAFullNameAppearExactlyOnceAcrossPages() throws Exception {
        List<Integer> savedIds = new java.util.ArrayList<>();
        for (int i = 0; i < 12; i++) {
            savedIds.add(saveOwner("Kevin", "McCallister", "Winnetka"));
        }

        List<Integer> pagedIds = new java.util.ArrayList<>();
        for (int page = 0; page < 3; page++) {
            search("/api/owners?lastName=McCallister&size=5&sort=name,asc&page=" + page)
                    .forEach(owner -> pagedIds.add(owner.getId()));
        }

        assertThat(pagedIds).isEqualTo(savedIds);
    }

    @Test
    void list_descendingAppliesToEveryKeyOfTheName() throws Exception {
        int first = saveOwner("Kevin", "McCallister", "Winnetka");
        int second = saveOwner("Kevin", "McCallister", "Winnetka");

        assertThat(search("/api/owners?lastName=McCallister&sort=name,desc"))
                .extracting(OwnerDto::getId).containsExactly(second, first);
    }

    @Test
    void list_diacriticsSortNextToTheirBaseLetter() throws Exception {
        saveOwner("Tom", "Smith", "London");
        saveOwner("Ștefan", "Smith", "London");

        assertThat(search("/api/owners?size=20&sort=name,asc"))
                .extracting(OwnerDto::getFirstName).containsExactly("George", "Ștefan", "Tom");
    }

    @Test
    void list_lowercaseDoesNotPushACityToTheEnd() throws Exception {
        saveOwner("Ann", "Smith", "Edinburgh");
        saveOwner("Bob", "Smith", "Dublin");
        saveOwner("Cid", "Smith", "de Panne");

        assertThat(citiesSortedBy("city,asc"))
                .containsExactly("de Panne", "Dublin", "Edinburgh", "London");
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "size=7|size", "size=1000|size", "size=0|size", "page=-1|page",
            "sort=telephone,asc|sort", "sort=name,sideways|sort", "sort=name,asc,extra|sort"})
    void list_invalidPagingParameter_400NamingTheParameter(String query, String parameter) throws Exception {
        mockMvc.perform(get("/api/owners?" + query))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail", containsString(parameter)));
    }

    @ParameterizedTest
    @ValueSource(strings = {"size=5", "size=10", "size=20", "sort=name", "sort=NAME,DESC", "sort=city,desc"})
    void list_validPagingParameter_200(String query) throws Exception {
        mockMvc.perform(get("/api/owners?" + query))
                .andExpect(status().isOk());
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

}
