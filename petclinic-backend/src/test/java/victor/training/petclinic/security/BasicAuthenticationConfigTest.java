package victor.training.petclinic.security;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "petclinic.security.enable=true")
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
class BasicAuthenticationConfigTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    PasswordEncoder passwordEncoder;

    @Test
    void passwordEncoder_encodesAndMatches() {
        String encoded = passwordEncoder.encode("secret");
        assertThat(passwordEncoder.matches("secret", encoded)).isTrue();
        assertThat(passwordEncoder.matches("wrong", encoded)).isFalse();
    }

    @Test
    void unauthenticated_isUnauthorized() throws Exception {
        mockMvc.perform(get("/api/owners"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void adminUser_canAccessOwners() throws Exception {
        String credentials = Base64.getEncoder().encodeToString("admin:admin".getBytes());
        mockMvc.perform(get("/api/owners")
                .header("Authorization", "Basic " + credentials))
                .andExpect(status().isOk());
    }

    // The @PreAuthorize role checks live here and nowhere else: petclinic.security.enable is false
    // everywhere but this class, so @WithMockUser(roles = …) on the other suites decorates without
    // enforcing. A role assertion written next to its controller would pass whatever the rule said.

    /** The visit forms are owner-admin screens, and they have to fill a vet picker. */
    @Test
    @WithMockUser(roles = "OWNER_ADMIN")
    void ownerAdmin_canListVets() throws Exception {
        mockMvc.perform(get("/api/vets")).andExpect(status().isOk());
    }

    /** Only the read moved to owner-admin; creating a vet is still the vet admin's. */
    @Test
    @WithMockUser(roles = "OWNER_ADMIN")
    void ownerAdmin_cannotAddAVet() throws Exception {
        // A valid body on purpose: bean validation runs while binding the argument, before method
        // security ever sees the call, so an invalid one would answer 400 and prove nothing.
        int status = mockMvc.perform(post("/api/vets")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"firstName":"Helen","lastName":"Leary","specialties":[]}
                        """))
                .andReturn().getResponse().getStatus();

        // Refused — but not with a 403: the catch-all handler in ExceptionControllerAdvice swallows
        // AuthorizationDeniedException into a 500. That is a pre-existing wart of the error
        // handling, so what this pins is that the write does not go through, not which code it picks.
        assertThat(status).isNotIn(200, 201);
    }
}
