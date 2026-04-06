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
import java.util.List;

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

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import jakarta.transaction.Transactional;

@SpringBootTest
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
        Owner owner = ownerRepository.save(TestData.anOwner()
            .setFirstName("George")
            .setLastName("Franklin"));
        ownerId = owner.getId();

        petType = petTypeRepository.save(new PetType().setName("dog"));

        Pet pet = petRepository.save(new Pet()
            .setName("Rosy")
            .setBirthDate(LocalDate.now())
            .setOwner(owner)
            .setType(petType));
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
        List<OwnerDto> owners = search("/api/owners");

        assertThat(owners)
            .extracting(OwnerDto::getId, OwnerDto::getFirstName, OwnerDto::getLastName)
            .contains(Assertions.tuple(ownerId, "George", "Franklin"));
    }

    @Test
    void getAllWithNameFilter() throws Exception {
        // Create another owner with a different last name
        int owner2Id = ownerRepository.save(TestData.anOwner()
            .setFirstName("Betty")
            .setLastName("Davis")).getId();

        List<OwnerDto> owners = search("/api/owners?q=avi");

        assertThat(owners)
            .extracting(OwnerDto::getId, OwnerDto::getLastName)
            .contains(Assertions.tuple(owner2Id, "Davis"))
            .doesNotContain(Assertions.tuple(ownerId, "Franklin"));
    }

    @Test
    void getAllWithTextFilter_matchesAllSupportedFields_caseInsensitiveContains() throws Exception {
        Owner owner2 = ownerRepository.save(TestData.anOwner()
            .setFirstName("Beatrice")
            .setLastName("McDonald")
            .setAddress("42 Evergreen Terrace")
            .setCity("Springfield")
            .setTelephone("5550001234"));

        Pet pet2 = petRepository.save(new Pet()
            .setName("Nibbles")
            .setBirthDate(LocalDate.now())
            .setOwner(owner2)
            .setType(petType));
        owner2.addPet(pet2);

        assertSearchReturnsOwner("atri", owner2.getId());
        assertSearchReturnsOwner("onaL", owner2.getId());
        assertSearchReturnsOwner("greeN", owner2.getId());
        assertSearchReturnsOwner("NGFI", owner2.getId());
        assertSearchReturnsOwner("0012", owner2.getId());
        assertSearchReturnsOwner("BBL", owner2.getId());
    }

    @Test
    void getAllWithTextFilter_matchesFirstNameContains_caseInsensitive() throws Exception {
        List<OwnerDto> owners = search("/api/owners?q=EOR");

        assertThat(owners)
            .extracting(OwnerDto::getId, OwnerDto::getFirstName)
            .contains(Assertions.tuple(ownerId, "George"));
    }

    private void assertSearchReturnsOwner(String term, int expectedOwnerId) throws Exception {
        List<OwnerDto> owners = search("/api/owners?q=" + term);

        assertThat(owners)
            .extracting(OwnerDto::getId)
            .contains(expectedOwnerId);
    }

    private List<OwnerDto> search(String uriTemplate) throws Exception {
        String responseJson = mockMvc.perform(get(uriTemplate))
            .andExpect(status().isOk())
            .andExpect(content().contentType("application/json"))
            .andReturn()
            .getResponse()
            .getContentAsString();

        return mapper.readValue(responseJson, new TypeReference<>() {
        });
    }

    @Test
    void getAllWithNameFilter_notFound() throws Exception {
        List<OwnerDto> results = search("/api/owners?q=NonExistent");

        assertThat(results).isEmpty();
    }

    @Test
    void create_ok() throws Exception {
        OwnerDto newOwner = new OwnerDto()
            .setFirstName("Eduardo")
            .setLastName("Rodriquez")
            .setAddress("2693 Commerce St.")
            .setCity("McFarland")
            .setTelephone("6085558763");

        mockMvc.perform(post("/api/owners")
                .content(mapper.writeValueAsString(newOwner))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().isCreated());
    }

    @Test
    void create_invalid() throws Exception {
        OwnerDto newOwner = new OwnerDto()
            // missing firstName - validation error
            .setLastName("Rodriquez")
            .setAddress("2693 Commerce St.")
            .setCity("McFarland")
            .setTelephone("6085558763");

        mockMvc.perform(post("/api/owners")
                .content(mapper.writeValueAsString(newOwner))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().isBadRequest());
    }

    @Test
    void update_ok() throws Exception {
        OwnerDto existing = callGet(ownerId)
            .setFirstName("GeorgeI");

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
        OwnerDto existing = callGet(ownerId)
            .setId(null) // Test without body ID
            .setFirstName("GeorgeII");

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
        OwnerDto existing = callGet(ownerId)
            .setFirstName(""); // invalid firstName

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
        PetDto newPet = new PetDto()
            .setName("Max")
            .setBirthDate(LocalDate.now())
            .setType(new PetTypeDto()
                .setId(petType.getId())
                .setName(petType.getName()));

        mockMvc.perform(post("/api/owners/" + ownerId + "/pets")
                .content(mapper.writeValueAsString(newPet))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().isCreated());
    }

    @Test
    void createPet_invalid() throws Exception {
        PetDto newPet = new PetDto()
            // missing name - validation error
            .setBirthDate(LocalDate.now())
            .setType(new PetTypeDto()
                .setId(petType.getId())
                .setName(petType.getName()));

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
        PetDto petDto = new PetDto()
            .setId(petId)
            .setName("Rosy Updated")
            .setBirthDate(LocalDate.of(2020, 1, 15))
            .setType(new PetTypeDto()
                .setId(petType.getId())
                .setName(petType.getName()));

        mockMvc.perform(put("/api/owners/" + ownerId + "/pets/" + petId)
                .content(mapper.writeValueAsString(petDto))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().is2xxSuccessful());
    }

    @Test
    void updateOwnerPet_ownerNotFound() throws Exception {
        PetDto petDto = new PetDto()
            .setName("Thor")
            .setBirthDate(LocalDate.now())
            .setType(new PetTypeDto()
                .setId(petType.getId())
                .setName(petType.getName()));

        mockMvc.perform(put("/api/owners/99999/pets/" + petId)
                .content(mapper.writeValueAsString(petDto))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().is2xxSuccessful());
    }

    @Test
    void updateOwnerPet_petNotFound() throws Exception {
        PetDto petDto = new PetDto()
            .setName("Ghost")
            .setBirthDate(LocalDate.of(2020, 1, 1))
            .setType(new PetTypeDto()
                .setId(petType.getId())
                .setName(petType.getName()));

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
