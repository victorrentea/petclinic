package org.springframework.samples.petclinic.rest;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import jakarta.transaction.Transactional;
import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.samples.petclinic.model.Owner;
import org.springframework.samples.petclinic.model.PetType;
import org.springframework.samples.petclinic.repository.OwnerRepository;
import org.springframework.samples.petclinic.repository.PetRepository;
import org.springframework.samples.petclinic.repository.PetTypeRepository;
import org.springframework.samples.petclinic.rest.dto.PetDto;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.text.SimpleDateFormat;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
public class PetTest {
    public static final LocalDate BIRTH_DATE = LocalDate.of(2010, 10, 10);
    @Autowired
    MockMvc mockMvc;

    ObjectMapper mapper = new ObjectMapper()
        .registerModule(new JavaTimeModule())
        .setDateFormat(new SimpleDateFormat("yyyy-MM-dd"))
        .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    @Autowired
    PetRepository petRepository;
    @Autowired
    OwnerRepository ownerRepository;
    int petId;
    @Autowired
    private PetTypeRepository petTypeRepository;

    @BeforeEach
    final void before() {
        Owner owner = ownerRepository.save(TestData.anOwner());
        petId = petRepository.save(TestData.aPet()
            .setOwner(owner)
            .setType(petTypeRepository.save(new PetType().setName("cat")))
        ).getId();
    }

    private PetDto callGet(int petId1) throws Exception {
        String responseJson = mockMvc.perform(get("/api/pets/" + petId1))
            .andExpect(status().isOk())
            .andExpect(content().contentType("application/json"))
            .andReturn()
            .getResponse()
            .getContentAsString();
        return mapper.readValue(responseJson, PetDto.class);
    }

    @Test
    void getByIdOk() throws Exception {
        PetDto responseDto = callGet(petId);

        assertThat(responseDto.getId()).isEqualTo(petId);
        assertThat(responseDto.getName()).isEqualTo("Leo");
        assertThat(responseDto.getType().getName()).isEqualTo("cat");
        assertThat(responseDto.getBirthDate()).isEqualTo(BIRTH_DATE);
    }

    @Test
    void getById_notFound() throws Exception {
        mockMvc.perform(get("/api/pets/99999"))
            .andExpect(status().isNotFound());
    }

    @Test
    void getAll() throws Exception {
        String responseJson = mockMvc.perform(get("/api/pets"))
            .andExpect(status().isOk())
            .andExpect(content().contentType("application/json"))
            .andReturn()
            .getResponse()
            .getContentAsString();
        PetDto[] pets = mapper.readValue(responseJson, PetDto[].class);

        assertThat(pets)
            .extracting(PetDto::getId, PetDto::getName, p -> p.getType().getName(), PetDto::getBirthDate)
            .contains(Assertions.tuple(petId, "Leo", "cat", BIRTH_DATE));
    }

    @Test
    void update_ok() throws Exception {
        PetDto existing = callGet(petId);
        existing.setName("Leo II");

        mockMvc.perform(put("/api/pets/" + petId)
                .content(mapper.writeValueAsString(existing))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().isOk());

        // assert the update took place
        PetDto updated = callGet(petId);
        assertThat(updated.getName()).isEqualTo("Leo II");
    }

    @Test
    void update_invalid() throws Exception {
        PetDto existing = callGet(petId);
        existing.setName(""); // invalid name

        mockMvc.perform(put("/api/pets/" + petId)
                .content(mapper.writeValueAsString(existing))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().is4xxClientError());
    }

    @Test
    void update_notFound() throws Exception {
        PetDto existing = callGet(petId);

        mockMvc.perform(put("/api/pets/99999")
                .content(mapper.writeValueAsString(existing))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().isNotFound());
    }

    @Test
    void delete_ok() throws Exception {
        mockMvc.perform(delete("/api/pets/" + petId))
            .andExpect(status().is2xxSuccessful());

        mockMvc.perform(get("/api/pets/" + petId))
            .andExpect(status().isNotFound());
    }

    @Test
    void delete_notFound() throws Exception {
        mockMvc.perform(delete("/api/pets/9999"))
            .andExpect(status().isNotFound());
    }
}
