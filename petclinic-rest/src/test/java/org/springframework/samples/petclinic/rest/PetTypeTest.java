package org.springframework.samples.petclinic.rest;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
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
import org.springframework.samples.petclinic.rest.dto.PetTypeDto;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.assertj.core.api.Assertions;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
public class PetTypeTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    PetTypeRepository petTypeRepository;

    @Autowired
    EntityManager entityManager;

    @Autowired
    PetRepository petRepository;

    @Autowired
    OwnerRepository ownerRepository;

    ObjectMapper mapper = new ObjectMapper();

    int petTypeId;

    @BeforeEach
    final void before() {
        petTypeId = petTypeRepository.save(new PetType().setName("cat")).getId();
    }

    private PetTypeDto callGet(int petTypeId) throws Exception {
        String responseJson = mockMvc.perform(get("/api/pettypes/" + petTypeId))
            .andExpect(status().isOk())
            .andExpect(content().contentType("application/json"))
            .andReturn()
            .getResponse()
            .getContentAsString();
        return mapper.readValue(responseJson, PetTypeDto.class);
    }

    @Test
    @WithMockUser(roles = "VET_ADMIN")
    void getPetTypeSuccessAsOwnerAdmin() throws Exception {
        PetTypeDto responseDto = callGet(petTypeId);

        assertThat(responseDto.getId()).isEqualTo(petTypeId);
        assertThat(responseDto.getName()).isEqualTo("cat");
    }

    @Test
    @WithMockUser(roles = "VET_ADMIN")
    void getPetType_notFound() throws Exception {
        mockMvc.perform(get("/api/pettypes/99999"))
            .andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser(roles = "VET_ADMIN")
    void getAllPetTypesSuccessAsOwnerAdmin() throws Exception {
        String responseJson = mockMvc.perform(get("/api/pettypes"))
            .andExpect(status().isOk())
            .andExpect(content().contentType("application/json"))
            .andReturn()
            .getResponse()
            .getContentAsString();
        PetTypeDto[] petTypes = mapper.readValue(responseJson, PetTypeDto[].class);

        assertThat(petTypes).hasSizeGreaterThanOrEqualTo(1);
        assertThat(petTypes)
            .extracting(PetTypeDto::getId, PetTypeDto::getName)
            .contains(Assertions.tuple(petTypeId, "cat"));
    }

    @Test
    @WithMockUser(roles = "VET_ADMIN")
    void createPetType_ok() throws Exception {
        PetTypeDto newPetType = new PetTypeDto();
        newPetType.setName("rabbit");

        String locationHeader = mockMvc.perform(post("/api/pettypes")
                .content(mapper.writeValueAsString(newPetType))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getHeader("Location");

        var newId = Integer.parseInt(locationHeader.substring(locationHeader.lastIndexOf('/') + 1));

        PetTypeDto retrieved = callGet(newId);
        assertThat(retrieved.getName()).isEqualTo("rabbit");
    }

    @Test
    @WithMockUser(roles = "VET_ADMIN")
    void createPetType_invalid() throws Exception {
        PetTypeDto newPetType = new PetTypeDto();
        newPetType.setName(""); // invalid - empty name

        mockMvc.perform(post("/api/pettypes")
                .content(mapper.writeValueAsString(newPetType))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().is4xxClientError());
    }

    @Test
    @WithMockUser(roles = "VET_ADMIN")
    void updatePetType_ok() throws Exception {
        PetTypeDto existing = callGet(petTypeId);
        existing.setName("cat II");

        mockMvc.perform(put("/api/pettypes/" + petTypeId)
                .content(mapper.writeValueAsString(existing))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().is2xxSuccessful());

        // Verify the update took place
        PetTypeDto updated = callGet(petTypeId);
        assertThat(updated.getName()).isEqualTo("cat II");
    }

    @Test
    @WithMockUser(roles = "VET_ADMIN")
    void updatePetType_invalid() throws Exception {
        PetTypeDto existing = callGet(petTypeId);
        existing.setName(""); // invalid - empty name

        mockMvc.perform(put("/api/pettypes/" + petTypeId)
                .content(mapper.writeValueAsString(existing))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().is4xxClientError());
    }

    @Test
    @WithMockUser(roles = "VET_ADMIN")
    void deletePetType_ok() throws Exception {
        mockMvc.perform(delete("/api/pettypes/" + petTypeId))
            .andExpect(status().is2xxSuccessful());

        // Verify it was deleted
        mockMvc.perform(get("/api/pettypes/" + petTypeId))
            .andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser(roles = "VET_ADMIN")
    void deletePetType_notFound() throws Exception {
        mockMvc.perform(delete("/api/pettypes/99999"))
            .andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser(roles = "VET_ADMIN")
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void deletePetType_inUse_returnsConflict() throws Exception {
        // create an owner and pet that references the petType
        Owner owner = ownerRepository.save(TestData.anOwner());
        Pet pet = TestData.aPet()
            .setOwner(owner)
            .setType(petTypeRepository.findById(petTypeId).orElseThrow());
        petRepository.save(pet);

        mockMvc.perform(delete("/api/pettypes/" + petTypeId))
            .andExpect(status().isInternalServerError())
            .andExpect(result -> assertThat(result.getResponse().getContentAsString()
                .contains("PetType is in use by existing pets and cannot be deleted")).isTrue());
    }

}
