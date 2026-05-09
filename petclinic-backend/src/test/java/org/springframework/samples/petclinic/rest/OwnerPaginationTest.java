package org.springframework.samples.petclinic.rest;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.samples.petclinic.model.Owner;
import org.springframework.samples.petclinic.model.Pet;
import org.springframework.samples.petclinic.model.PetType;
import org.springframework.samples.petclinic.repository.OwnerRepository;
import org.springframework.samples.petclinic.repository.PetRepository;
import org.springframework.samples.petclinic.repository.PetTypeRepository;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.transaction.Transactional;

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerPaginationTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    OwnerRepository ownerRepository;

    @Autowired
    PetRepository petRepository;

    @Autowired
    PetTypeRepository petTypeRepository;

    int ownerId;

    @BeforeEach
    void setUp() {
        Owner owner = new Owner()
            .setFirstName("George")
            .setLastName("Franklin")
            .setAddress("110 W. Liberty St.")
            .setCity("Madison")
            .setTelephone("6085551023");
        owner = ownerRepository.save(owner);
        ownerId = owner.getId();

        PetType petType = new PetType();
        petType.setName("cat");
        petType = petTypeRepository.save(petType);

        Pet pet = new Pet();
        pet.setName("Leo");
        pet.setBirthDate(LocalDate.of(2020, 1, 1));
        pet.setOwner(owner);
        pet.setType(petType);
        petRepository.save(pet);

        owner.addPet(pet);
    }

    @Test
    void listOwners_returnsPageWithOwnerSummaryDtoShape() throws Exception {
        mockMvc.perform(get("/api/owners"))
            .andExpect(status().isOk())
            .andExpect(content().contentType("application/json"))
            // Page metadata
            .andExpect(jsonPath("$.totalElements").isNumber())
            .andExpect(jsonPath("$.totalPages").isNumber())
            .andExpect(jsonPath("$.number").value(0))
            .andExpect(jsonPath("$.size").value(10))
            // Content contains OwnerSummaryDto fields
            .andExpect(jsonPath("$.content[0].displayName").exists())
            .andExpect(jsonPath("$.content[0].id").exists())
            .andExpect(jsonPath("$.content[0].address").exists())
            .andExpect(jsonPath("$.content[0].city").exists())
            .andExpect(jsonPath("$.content[0].telephone").exists())
            .andExpect(jsonPath("$.content[0].pets").isArray())
            .andExpect(jsonPath("$.content[0].pets[0].id").exists())
            .andExpect(jsonPath("$.content[0].pets[0].name").exists())
            // OwnerSummaryDto should NOT have firstName/lastName (those belong to OwnerDto)
            .andExpect(jsonPath("$.content[0].firstName").doesNotExist())
            .andExpect(jsonPath("$.content[0].lastName").doesNotExist());
    }

    @Test
    void listOwners_defaultsToPage0Size10() throws Exception {
        mockMvc.perform(get("/api/owners"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.number").value(0))
            .andExpect(jsonPath("$.size").value(10));
    }

    @Test
    void listOwners_displayNameIsConcatenatedFirstAndLastName() throws Exception {
        String responseJson = mockMvc.perform(get("/api/owners?size=100"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        com.fasterxml.jackson.databind.JsonNode root = mapper.readTree(responseJson);
        com.fasterxml.jackson.databind.JsonNode content = root.get("content");

        boolean found = false;
        for (com.fasterxml.jackson.databind.JsonNode node : content) {
            if (node.get("id").asInt() == ownerId) {
                org.assertj.core.api.Assertions.assertThat(node.get("displayName").asText())
                    .isEqualTo("George Franklin");
                found = true;
                break;
            }
        }
        org.assertj.core.api.Assertions.assertThat(found)
            .as("Owner with id %d should be in the list", ownerId)
            .isTrue();
    }

    @Test
    void getOwner_stillReturnsOwnerDtoWithFirstNameAndLastName() throws Exception {
        mockMvc.perform(get("/api/owners/" + ownerId))
            .andExpect(status().isOk())
            .andExpect(content().contentType("application/json"))
            .andExpect(jsonPath("$.id").value(ownerId))
            .andExpect(jsonPath("$.firstName").value("George"))
            .andExpect(jsonPath("$.lastName").value("Franklin"))
            // OwnerDto should NOT have displayName
            .andExpect(jsonPath("$.displayName").doesNotExist());
    }
}
