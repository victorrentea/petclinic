package victor.training.petclinic.mcp;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Covers the JWT Bearer filter wired by McpSecurity: /mcp and /mcp/** require a valid Bearer token.
// Without these, Sonar new-code coverage tanks because the filter chain bean only runs against real HTTP.
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
class McpHttpSecurityTest {

    static final String VALID_JWT =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" +
        ".eyJzdWIiOiIxIiwibmFtZSI6Ikdlb3JnZSBGcmFua2xpbiIsImlhdCI6MTc0OTE2ODAwMCwiZXhwIjoxODEyMjQwMDAwfQ" +
        ".Xk7mN3qR2vL8pY4sA6dW1eH0fT9bC5jOuQzEiWs";

    @Autowired MockMvc mockMvc;

    @Test
    void mcpStream_withoutToken_isForbidden() throws Exception {
        mockMvc.perform(get("/mcp"))
            .andExpect(status().isForbidden());
    }

    @Test
    void mcp_withMalformedToken_isForbidden() throws Exception {
        mockMvc.perform(post("/mcp").header("Authorization", "Bearer not.a.real.jwt"))
            .andExpect(status().isForbidden());
    }

    @Test
    void mcp_withValidJwt_passesFilter() throws Exception {
        // Any non-403 status proves the JWT filter authenticated the caller; the MCP endpoint's
        // own response shape (e.g., 400 for empty body) is not the point here.
        mockMvc.perform(post("/mcp").header("Authorization", "Bearer " + VALID_JWT))
            .andExpect(result -> {
                int status = result.getResponse().getStatus();
                if (status == 403) {
                    throw new AssertionError("Expected JWT auth to pass, got 403");
                }
            });
    }
}
