package victor.training.petclinic.mcp;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Covers the service-key gate wired by McpSecurity: every /mcp request must carry a valid X-API-Key.
// (The per-user identity — the JWT sub — is layered on top, but the API key is what gates the transport.)
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
class McpHttpSecurityTest {

    static final String VALID_JWT =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" +
        ".eyJzdWIiOiIxIiwibmFtZSI6Ikdlb3JnZSBGcmFua2xpbiIsImlhdCI6MTc0OTE2ODAwMCwiZXhwIjoxODEyMjQwMDAwfQ" +
        ".Xk7mN3qR2vL8pY4sA6dW1eH0fT9bC5jOuQzEiWs";

    @Autowired MockMvc mockMvc;

    @Value("${petclinic.mcp.api-key}") String apiKey;

    @Test
    void mcp_withoutApiKey_isUnauthorized() throws Exception {
        mockMvc.perform(get("/mcp"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void mcp_withWrongApiKey_isUnauthorized() throws Exception {
        mockMvc.perform(get("/mcp").header("X-API-Key", "not-the-key"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void mcp_withApiKey_passesTheServiceGate() throws Exception {
        // The API key authenticates the calling service; any non-401 proves it passed the gate (the
        // MCP endpoint's own response shape — e.g. 400 for an empty body — is not the point here).
        mockMvc.perform(post("/mcp").header("X-API-Key", apiKey).header("Authorization", "Bearer " + VALID_JWT))
            .andExpect(result -> {
                if (result.getResponse().getStatus() == 401) {
                    throw new AssertionError("Expected the API key to pass the service gate, got 401");
                }
            });
    }
}
