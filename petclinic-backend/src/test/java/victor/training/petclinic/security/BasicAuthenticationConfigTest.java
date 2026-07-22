package victor.training.petclinic.security;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
}
