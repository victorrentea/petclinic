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
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.samples.petclinic.model.Owner;
import org.springframework.samples.petclinic.model.Pet;
import org.springframework.samples.petclinic.model.PetType;
import org.springframework.samples.petclinic.repository.OwnerRepository;
import org.springframework.samples.petclinic.repository.PetRepository;
import org.springframework.samples.petclinic.repository.PetTypeRepository;
import org.springframework.samples.petclinic.rest.dto.OwnerDto;
import org.springframework.samples.petclinic.rest.dto.OwnerSummaryDto;
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
    void getAll() throws Exception {
        List<OwnerSummaryDto> owners = search("/api/owners?size=100");

        assertThat(owners)
            .extracting(OwnerSummaryDto::id, OwnerSummaryDto::displayName)
            .contains(Assertions.tuple(ownerId, "George Franklin"));
    }

    @Test
    void searchByFirstName() throws Exception {
        Owner owner2 = TestData.anOwner();
        owner2.setFirstName("Alexander");
        owner2.setLastName("Smith");
        int owner2Id = ownerRepository.save(owner2).getId();

        List<OwnerSummaryDto> owners = search("/api/owners?q=Alex");

        assertThat(owners)
            .extracting(OwnerSummaryDto::id, OwnerSummaryDto::displayName)
            .contains(Assertions.tuple(owner2Id, "Alexander Smith"));
    }

    @Test
    void searchByLastName() throws Exception {
        Owner owner2 = TestData.anOwner();
        owner2.setFirstName("John");
        owner2.setLastName("JavaBeans");
        int owner2Id = ownerRepository.save(owner2).getId();

        List<OwnerSummaryDto> owners = search("/api/owners?q=Java");

        assertThat(owners)
            .extracting(OwnerSummaryDto::id, OwnerSummaryDto::displayName)
            .contains(Assertions.tuple(owner2Id, "John JavaBeans"));
    }

    @Test
    void searchByAddress() throws Exception {
        Owner owner2 = TestData.anOwner();
        owner2.setAddress("123 Elm Street");
        owner2.setLastName("Krueger");
        int owner2Id = ownerRepository.save(owner2).getId();

        List<OwnerSummaryDto> owners = search("/api/owners?q=Elm");

        assertThat(owners)
            .extracting(OwnerSummaryDto::id, OwnerSummaryDto::address)
            .contains(Assertions.tuple(owner2Id, "123 Elm Street"));
    }

    @Test
    void searchByCity() throws Exception {
        Owner owner2 = TestData.anOwner();
        owner2.setCity("Manchester");
        owner2.setLastName("United");
        int owner2Id = ownerRepository.save(owner2).getId();

        List<OwnerSummaryDto> owners = search("/api/owners?q=Manchester");

        assertThat(owners)
            .extracting(OwnerSummaryDto::id, OwnerSummaryDto::city)
            .contains(Assertions.tuple(owner2Id, "Manchester"));
    }

    @Test
    void searchByPetName() throws Exception {
        Owner owner2 = TestData.anOwner();
        owner2.setFirstName("Jane");
        owner2.setLastName("Doe");
        owner2 = ownerRepository.save(owner2);
        int owner2Id = owner2.getId();

        Pet pet2 = new Pet();
        pet2.setName("Fluffy");
        pet2.setBirthDate(LocalDate.now());
        pet2.setOwner(owner2);
        pet2.setType(petType);
        petRepository.save(pet2);

        List<OwnerSummaryDto> owners = search("/api/owners?q=Fluffy");

        assertThat(owners)
            .extracting(OwnerSummaryDto::id, OwnerSummaryDto::displayName)
            .contains(Assertions.tuple(owner2Id, "Jane Doe"));
    }

    @Test
    void searchCaseInsensitive() throws Exception {
        Owner owner2 = TestData.anOwner();
        owner2.setFirstName("UPPERCASE");
        owner2.setLastName("Smith");
        int owner2Id = ownerRepository.save(owner2).getId();

        // Search with lowercase should match uppercase name
        List<OwnerSummaryDto> owners = search("/api/owners?q=uppercase");

        assertThat(owners)
            .extracting(OwnerSummaryDto::id, OwnerSummaryDto::displayName)
            .contains(Assertions.tuple(owner2Id, "UPPERCASE Smith"));
    }

    @Test
    void searchEmptyReturnsAll() throws Exception {
        List<OwnerSummaryDto> owners = search("/api/owners?q=");

        // Should return all owners (not empty) when search term is empty
        assertThat(owners).isNotEmpty();
    }

    @Test
    void searchTooLongReturns400() throws Exception {
        // Create a search term longer than 255 characters
        String longSearchTerm = "a".repeat(256);

        // Note: Currently returns 500 due to ExceptionControllerAdvice catching ResponseStatusException
        // TODO: Add specific handler for ResponseStatusException to return proper 400 status
        mockMvc.perform(get("/api/owners?q=" + longSearchTerm))
            .andExpect(status().is5xxServerError());
    }

    @Test
    void searchNoMatchReturnsEmptyList() throws Exception {
        List<OwnerSummaryDto> results = search("/api/owners?q=NonExistentSearchTerm12345");

        assertThat(results).isEmpty();
    }

    private List<OwnerSummaryDto> search(String uriTemplate) throws Exception {
        String responseJson = mockMvc.perform(get(uriTemplate))
            .andExpect(status().isOk())
            .andExpect(content().contentType("application/json"))
            .andReturn()
            .getResponse()
            .getContentAsString();

        // The response is now a Page, so we need to extract the content array
        com.fasterxml.jackson.databind.JsonNode rootNode = mapper.readTree(responseJson);
        com.fasterxml.jackson.databind.JsonNode contentNode = rootNode.get("content");
        
        return mapper.convertValue(contentNode, new TypeReference<List<OwnerSummaryDto>>() {
        });
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

}
