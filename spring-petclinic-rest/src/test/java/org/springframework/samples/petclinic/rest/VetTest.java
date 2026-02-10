package org.springframework.samples.petclinic.rest;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.transaction.Transactional;
import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.samples.petclinic.model.Vet;
import org.springframework.samples.petclinic.repository.VetRepository;
import org.springframework.samples.petclinic.rest.dto.VetDto;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;

@SpringBootTest
@AutoConfigureMockMvc
@WithMockUser(roles = "VET_ADMIN")
@Transactional
public class VetTest {

    @Autowired
    MockMvc mockMvc;

    ObjectMapper mapper = new ObjectMapper()
        .setSerializationInclusion(JsonInclude.Include.ALWAYS);

    @Autowired
    VetRepository vetRepository;

    int vetId;

    @BeforeEach
    final void before() {
        Vet vet = new Vet();
        vet.setFirstName("James");
        vet.setLastName("Carter");
        vetRepository.save(vet);
        vetId = vet.getId();
    }

    private VetDto callGet(int vetId) throws Exception {
        String responseJson = mockMvc.perform(get("/api/vets/" + vetId))
            .andExpect(status().isOk())
            .andExpect(content().contentType("application/json"))
            .andReturn()
            .getResponse()
            .getContentAsString();
        return mapper.readValue(responseJson, VetDto.class);
    }

    @Test
    void getByIdOk() throws Exception {
        VetDto responseDto = callGet(vetId);

        assertThat(responseDto.getId()).isEqualTo(vetId);
        assertThat(responseDto.getFirstName()).isEqualTo("James");
        assertThat(responseDto.getLastName()).isEqualTo("Carter");
    }

    @Test
    void getById_notFound() throws Exception {
        mockMvc.perform(get("/api/vets/99999"))
            .andExpect(status().isNotFound());
    }

    @Test
    void getAll() throws Exception {
        String responseJson = mockMvc.perform(get("/api/vets"))
            .andExpect(status().isOk())
            .andExpect(content().contentType("application/json"))
            .andReturn()
            .getResponse()
            .getContentAsString();
        VetDto[] vets = mapper.readValue(responseJson, VetDto[].class);

        assertThat(vets)
            .extracting(VetDto::getId, VetDto::getFirstName, VetDto::getLastName)
            .contains(Assertions.tuple(vetId, "James", "Carter"));
    }

    @Test
    void create_ok() throws Exception {
        VetDto newVet = new VetDto();
        newVet.setFirstName("Helen");
        newVet.setLastName("Leary");

        mockMvc.perform(post("/api/vets")
                .content(mapper.writeValueAsString(newVet))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().isCreated());
    }

    @Test
    void create_invalid() throws Exception {
        VetDto newVet = new VetDto();
        newVet.setFirstName(null); // invalid - null firstName
        newVet.setLastName("Leary");

        mockMvc.perform(post("/api/vets")
                .content(mapper.writeValueAsString(newVet))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().is4xxClientError());
    }

    @Test
    void update_ok() throws Exception {
        VetDto existing = callGet(vetId);
        existing.setFirstName("James Updated");

        mockMvc.perform(put("/api/vets/" + vetId)
                .content(mapper.writeValueAsString(existing))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().is2xxSuccessful());

        // assert the update took place
        VetDto updated = callGet(vetId);
        assertThat(updated.getFirstName()).isEqualTo("James Updated");
    }

    @Test
    void delete_ok() throws Exception {
        mockMvc.perform(delete("/api/vets/" + vetId))
            .andExpect(status().is2xxSuccessful());

        mockMvc.perform(get("/api/vets/" + vetId))
            .andExpect(status().isNotFound());
    }

    @Test
    void delete_notFound() throws Exception {
        mockMvc.perform(delete("/api/vets/9999"))
            .andExpect(status().isNotFound());
    }
}
