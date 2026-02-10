package org.springframework.samples.petclinic.rest;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.samples.petclinic.rest.dto.RoleDto;
import org.springframework.samples.petclinic.rest.dto.UserDto;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@WithMockUser(roles = "ADMIN")
@Transactional
public class UserTest {

    @Autowired
    MockMvc mockMvc;

    ObjectMapper mapper = new ObjectMapper();

    @Test
    void create_ok() throws Exception {
        RoleDto roleDto = new RoleDto();
        roleDto.setName("OWNER_ADMIN");

        UserDto newUser = new UserDto();
        newUser.setUsername("newuser");
        newUser.setPassword("password123");
        newUser.setEnabled(true);
        newUser.getRoles().add(roleDto);

        mockMvc.perform(post("/api/users")
                .content(mapper.writeValueAsString(newUser))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().isCreated());
    }

    @Test
    void create_invalid() throws Exception {
        UserDto newUser = new UserDto();
        // Empty username - validation error
        newUser.setUsername("");
        newUser.setPassword("password123");
        newUser.setEnabled(true);

        mockMvc.perform(post("/api/users")
                .content(mapper.writeValueAsString(newUser))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().isBadRequest());
    }

    @Test
    void create_noRoles_triggers_server_error() throws Exception {
        // Send roles as null so the service sees user.getRoles() == null and throws
        UserDto newUser = new UserDto();
        newUser.setUsername("norolesuser");
        newUser.setPassword("password123");
        newUser.setEnabled(true);
        newUser.setRoles(null);

        mockMvc.perform(post("/api/users")
                .content(mapper.writeValueAsString(newUser))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().is5xxServerError());
    }
}
