package org.springframework.samples.petclinic.rest;

import jakarta.transaction.Transactional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
public class ValidationErrorRenderingTest {

    @Autowired
    MockMvc mockMvc;

    @Test
    void createOwner_withTwoValidationErrors_rendersErrorsArray() throws Exception {
        // Build JSON with two validation problems: empty firstName, telephone too short
        String payload = "{\"firstName\":\"\",\"lastName\":\"Smith\",\"address\":\"1 Road\",\"city\":\"Town\",\"telephone\":\"123\"}";

        mockMvc.perform(post("/api/owners")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors").exists())
            .andExpect(jsonPath("$.errors", hasSize(2)));
    }
}
