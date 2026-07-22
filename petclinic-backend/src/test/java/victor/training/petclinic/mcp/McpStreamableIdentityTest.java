package victor.training.petclinic.mcp;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;

import io.modelcontextprotocol.client.McpClient;
import io.modelcontextprotocol.client.McpSyncClient;
import io.modelcontextprotocol.client.transport.HttpClientStreamableHttpTransport;
import io.modelcontextprotocol.spec.McpSchema.CallToolRequest;
import io.modelcontextprotocol.spec.McpSchema.CallToolResult;
import io.modelcontextprotocol.spec.McpSchema.TextContent;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * True END-TO-END proof of out-of-band identity propagation over the real <b>Streamable HTTP</b>
 * transport (MCP spec 2025-06-18).
 *
 * <p>Boots the backend MCP server on a random port and drives it with a real {@link McpSyncClient}.
 * The owner identity travels ONLY as an {@code Authorization: Bearer <jwt>} HTTP header that the
 * calling application stamps on every request — never as a tool/resource argument (the LLM can neither
 * see nor set HTTP headers). {@code get_owner_profile} takes no arguments, so the profile returned is
 * determined purely by the header: owner 1 (sub=1) gets Kevin McCallister, owner 2 (sub=2) gets Harry
 * Potter, and neither can reach the other's data. {@code X-API-Key}
 * authenticates the calling application (service account); the Bearer is the per-call on-behalf-of
 * user assertion.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
class McpStreamableIdentityTest {

    @LocalServerPort int port;

    @Value("${petclinic.mcp.api-key}") String apiKey;

    @Test
    void owner1_bearer_header_yields_owner1_profile_over_the_wire() {
        String profile = readOwnerProfileAs(jwtForOwner(1));

        assertThat(profile).contains("Kevin").contains("McCallister").contains("Axel");
        assertThat(profile).doesNotContain("Harry"); // never crosses into another owner's data
    }

    @Test
    void owner2_bearer_header_yields_owner2_profile_over_the_wire() {
        String profile = readOwnerProfileAs(jwtForOwner(2));

        assertThat(profile).contains("Harry").contains("Potter").contains("Hedwig");
        assertThat(profile).doesNotContain("Kevin");
    }

    /**
     * Builds a real Streamable HTTP MCP client carrying {@code X-API-Key} (application) plus the owner's
     * Bearer JWT (on-behalf-of, OUT-OF-BAND), then calls the no-argument {@code get_owner_profile} tool.
     */
    private String readOwnerProfileAs(String jwt) {
        var transport = HttpClientStreamableHttpTransport.builder("http://localhost:" + port)
            .endpoint("/mcp")
            .httpRequestCustomizer((builder, method, uri, body, ctx) -> builder
                .header("X-API-Key", apiKey)
                .header("Authorization", "Bearer " + jwt))
            .build();
        try (McpSyncClient client = McpClient.sync(transport).build()) {
            client.initialize();
            CallToolResult result = client.callTool(
                CallToolRequest.builder().name("get_owner_profile").arguments(Map.of()).build());
            assertThat(result.isError()).isNotEqualTo(Boolean.TRUE);
            return result.content().stream()
                .filter(c -> c instanceof TextContent)
                .map(c -> ((TextContent) c).text())
                .reduce("", String::concat);
        }
    }

    /** A JWT the backend accepts: it base64-decodes the payload (no signature check) and reads {@code sub}. */
    private static String jwtForOwner(int ownerId) {
        return base64Url("{\"alg\":\"HS256\",\"typ\":\"JWT\"}")
            + "." + base64Url("{\"sub\":\"" + ownerId + "\"}")
            + ".sig";
    }

    private static String base64Url(String json) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(json.getBytes(StandardCharsets.UTF_8));
    }
}
