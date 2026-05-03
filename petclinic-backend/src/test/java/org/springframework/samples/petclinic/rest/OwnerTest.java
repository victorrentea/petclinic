package org.springframework.samples.petclinic.rest;

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

import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.samples.petclinic.model.Owner;
import org.springframework.samples.petclinic.model.Pet;
import org.springframework.samples.petclinic.model.PetType;
import org.springframework.samples.petclinic.repository.OwnerRepository;
import org.springframework.samples.petclinic.repository.PetRepository;
import org.springframework.samples.petclinic.repository.PetTypeRepository;
import org.springframework.samples.petclinic.rest.dto.OwnerDto;
import org.springframework.samples.petclinic.rest.dto.PetDto;
import org.springframework.samples.petclinic.rest.dto.PetTypeDto;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import jakarta.transaction.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
public class OwnerTest {

    private static final int DEFAULT_PAGE_SIZE = 10;
    private static final int LARGE_PAGE_SIZE = 20;
    private static final int MIN_LARGE_DATASET_SIZE = 1000;
    private static final String SORT_QUERY = "sort-bucket";
    private static final String FILTER_QUERY = "filter-bucket";

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
    void getAll() throws Exception {
        mockMvc.perform(get("/api/owners"))
            .andExpect(status().isOk())
            .andExpect(content().contentType("application/json"))
            .andExpect(jsonPath("$.content[*].id").value(org.hamcrest.Matchers.hasItem(ownerId)))
            .andExpect(jsonPath("$.number").value(0))
            .andExpect(jsonPath("$.size").value(DEFAULT_PAGE_SIZE));
    }

    @Test
    void getAllWithNameFilter() throws Exception {
        Owner owner2 = TestData.anOwner();
        owner2.setFirstName("Betty");
        owner2.setLastName("Davis");
        owner2.setAddress(FILTER_QUERY);
        int owner2Id = ownerRepository.save(owner2).getId();

        mockMvc.perform(get("/api/owners").param("query", FILTER_QUERY))
            .andExpect(status().isOk())
            .andExpect(content().contentType("application/json"))
            .andExpect(jsonPath("$.content[*].id").value(org.hamcrest.Matchers.hasItem(owner2Id)))
            .andExpect(jsonPath("$.content[*].id").value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.hasItem(ownerId))))
            .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void getAllWithAddressFilter() throws Exception {
        Owner owner2 = TestData.anOwner();
        owner2.setLastName("JavaBeans");
        owner2.setAddress(FILTER_QUERY);
        int owner2Id = ownerRepository.save(owner2).getId();

        mockMvc.perform(get("/api/owners").param("query", FILTER_QUERY))
            .andExpect(status().isOk())
            .andExpect(content().contentType("application/json"))
            .andExpect(jsonPath("$.content[*].id").value(org.hamcrest.Matchers.hasItem(owner2Id)));
    }

    @Test
    void getAllWithNameFilter_notFound() throws Exception {
        mockMvc.perform(get("/api/owners").param("query", "NonExistent"))
            .andExpect(status().isOk())
            .andExpect(content().contentType("application/json"))
            .andExpect(jsonPath("$.content").isEmpty())
            .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void getAllWithNameSortAscending() throws Exception {
        ownerRepository.save(TestData.anOwner()
            .setFirstName("Amy")
            .setLastName("Able")
            .setAddress(SORT_QUERY));
        ownerRepository.save(TestData.anOwner()
            .setFirstName("Zoe")
            .setLastName("Zimmer")
            .setAddress(SORT_QUERY));
        ownerRepository.save(TestData.anOwner()
            .setFirstName("George")
            .setLastName("Franklin")
            .setAddress(SORT_QUERY));

        mockMvc.perform(get("/api/owners")
                .param("query", SORT_QUERY)
                .param("sort", "name,asc"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].lastName").value("Able"))
            .andExpect(jsonPath("$.content[1].lastName").value("Franklin"))
            .andExpect(jsonPath("$.content[2].lastName").value("Zimmer"));
    }

    @Test
    void getAllWithCitySortDescending() throws Exception {
        ownerRepository.save(TestData.anOwner()
            .setFirstName("Amy")
            .setLastName("Able")
            .setCity("Amsterdam")
            .setAddress(SORT_QUERY));
        ownerRepository.save(TestData.anOwner()
            .setFirstName("Zoe")
            .setLastName("Zimmer")
            .setCity("Zurich")
            .setAddress(SORT_QUERY));
        ownerRepository.save(TestData.anOwner()
            .setFirstName("George")
            .setLastName("Franklin")
            .setCity("London")
            .setAddress(SORT_QUERY));

        mockMvc.perform(get("/api/owners")
                .param("query", SORT_QUERY)
                .param("sort", "city,desc"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].city").value("Zurich"))
            .andExpect(jsonPath("$.content[1].city").value("London"))
            .andExpect(jsonPath("$.content[2].city").value("Amsterdam"));
    }

    @Test
    void getAllWithLargePageSize() throws Exception {
        for (int i = 0; i < LARGE_PAGE_SIZE; i++) {
            ownerRepository.save(TestData.anOwner()
                .setFirstName("Owner" + i)
                .setLastName("Last" + i));
        }

        mockMvc.perform(get("/api/owners").param("size", String.valueOf(LARGE_PAGE_SIZE)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.size").value(LARGE_PAGE_SIZE))
            .andExpect(jsonPath("$.content.length()").value(LARGE_PAGE_SIZE));
    }

    @Test
    void getAllWithInvalidSort() throws Exception {
        mockMvc.perform(get("/api/owners").param("sort", "telephone,asc"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void getAllWithInvalidPageSize() throws Exception {
        mockMvc.perform(get("/api/owners").param("size", "15"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void getAllIncludesLargeSeedDataset() throws Exception {
        mockMvc.perform(get("/api/owners"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(org.hamcrest.Matchers.greaterThanOrEqualTo(MIN_LARGE_DATASET_SIZE)));
    }

    @Test
    void create_ok() throws Exception {
        OwnerDto newOwner = new OwnerDto();
        newOwner.setFirstName("Eduardo");
        newOwner.setLastName("Rodriquez");
        newOwner.setAddress("2693 Commerce St.");
        newOwner.setCity("McFarland");
        newOwner.setTelephone("6085558763");

        mockMvc.perform(post("/api/owners")
                .content(mapper.writeValueAsString(newOwner))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().isCreated());
    }

    @Test
    void create_invalid() throws Exception {
        OwnerDto newOwner = new OwnerDto();
        // missing firstName - validation error
        newOwner.setLastName("Rodriquez");
        newOwner.setAddress("2693 Commerce St.");
        newOwner.setCity("McFarland");
        newOwner.setTelephone("6085558763");

        mockMvc.perform(post("/api/owners")
                .content(mapper.writeValueAsString(newOwner))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().isBadRequest());
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
    void createPet_ok() throws Exception {
        PetDto newPet = new PetDto();
        newPet.setName("Max");
        newPet.setBirthDate(LocalDate.now());
        PetTypeDto typeDto = new PetTypeDto();
        typeDto.setId(petType.getId());
        typeDto.setName(petType.getName());
        newPet.setType(typeDto);

        mockMvc.perform(post("/api/owners/" + ownerId + "/pets")
                .content(mapper.writeValueAsString(newPet))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().isCreated());
    }

    @Test
    void createPet_invalid() throws Exception {
        PetDto newPet = new PetDto();
        // missing name - validation error
        newPet.setBirthDate(LocalDate.now());
        PetTypeDto typeDto = new PetTypeDto();
        typeDto.setId(petType.getId());
        typeDto.setName(petType.getName());
        newPet.setType(typeDto);

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
        PetDto petDto = new PetDto();
        petDto.setId(petId);
        petDto.setName("Rosy Updated");
        petDto.setBirthDate(LocalDate.of(2020, 1, 15));
        PetTypeDto typeDto = new PetTypeDto();
        typeDto.setId(petType.getId());
        typeDto.setName(petType.getName());
        petDto.setType(typeDto);

        mockMvc.perform(put("/api/owners/" + ownerId + "/pets/" + petId)
                .content(mapper.writeValueAsString(petDto))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().is2xxSuccessful());
    }

    @Test
    void updateOwnerPet_ownerNotFound() throws Exception {
        PetDto petDto = new PetDto();
        petDto.setName("Thor");
        petDto.setBirthDate(LocalDate.now());
        PetTypeDto typeDto = new PetTypeDto();
        typeDto.setId(petType.getId());
        typeDto.setName(petType.getName());
        petDto.setType(typeDto);

        mockMvc.perform(put("/api/owners/99999/pets/" + petId)
                .content(mapper.writeValueAsString(petDto))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().is2xxSuccessful());
    }

    @Test
    void updateOwnerPet_petNotFound() throws Exception {
        PetDto petDto = new PetDto();
        petDto.setName("Ghost");
        petDto.setBirthDate(LocalDate.of(2020, 1, 1));
        PetTypeDto typeDto = new PetTypeDto();
        typeDto.setId(petType.getId());
        typeDto.setName(petType.getName());
        petDto.setType(typeDto);

        mockMvc.perform(put("/api/owners/" + ownerId + "/pets/99999")
                .content(mapper.writeValueAsString(petDto))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().isNotFound());
    }

    @Test
    void getOwner_includesPetsWithType() throws Exception {
        // Verifies that owner response includes pets with their type name loaded (lazy-loading works)
        OwnerDto responseDto = callGet(ownerId);

        assertThat(responseDto.getPets()).hasSize(1);
        assertThat(responseDto.getPets().get(0).getName()).isEqualTo("Rosy");
        assertThat(responseDto.getPets().get(0).getType()).isNotNull();
        assertThat(responseDto.getPets().get(0).getType().getName()).isEqualTo("dog");
    }
}
