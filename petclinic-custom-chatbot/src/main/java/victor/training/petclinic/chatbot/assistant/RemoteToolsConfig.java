package victor.training.petclinic.chatbot.assistant;

import io.modelcontextprotocol.client.McpClient;
import io.modelcontextprotocol.client.McpSyncClient;
import io.modelcontextprotocol.client.transport.HttpClientStreamableHttpTransport;
import io.modelcontextprotocol.client.transport.customizer.McpSyncHttpClientRequestCustomizer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.core.context.SecurityContextHolder;

import java.net.http.HttpRequest;

/**
 * Wires the MCP <b>client</b> that calls the remote petclinic MCP server (the backend) for its tools.
 *
 * <p><b>One wire, two independent claims.</b> A SINGLE shared connection multiplexes the tool calls of
 * every conversation (all owners) to the backend. Each outgoing HTTP request carries TWO headers that
 * the LLM can neither see nor influence (they live on the transport, never in the JSON-RPC arguments):
 * <ul>
 *   <li><b>{@code X-API-Key}</b> — the static key issued to the chatbot <i>application</i>: a service
 *       account (AWS-style) that authenticates the CALLER. Rides every request, including the
 *       {@code initialize} call.</li>
 *   <li><b>{@code Authorization: Bearer <jwt>}</b> — the per-call ON-BEHALF-OF user assertion. Read
 *       OUT-OF-BAND from the chatbot's {@link SecurityContextHolder} at request time (the browser JWT
 *       of whichever owner's turn is in flight), so a user can never forge whose data is fetched. The
 *       backend unpacks its {@code sub} to scope owner-bound tools. Absent on the boot handshake (no
 *       user in context yet) → that request runs as the bare service identity, which is correct.</li>
 * </ul>
 *
 * <p>Both headers are attached via a per-request customizer (not {@code customizeRequest(Consumer)},
 * which runs once at connect time) so the live user is read per POST on the request's own thread.
 */
@Configuration
class RemoteToolsConfig {

    @Bean
    McpSyncClient petclinicMcpClient(
        @Value("${petclinic.chatbot.mcp.url}") String url,
        @Value("${petclinic.chatbot.mcp.api-key}") String apiKey) {
        McpSyncHttpClientRequestCustomizer perRequestHeaders =
            (builder, method, endpoint, body, context) -> injectHeaders(builder, apiKey);
        var transport = HttpClientStreamableHttpTransport.builder(url)
            .endpoint("/mcp")
            .httpRequestCustomizer(perRequestHeaders)
            .build();
        try {
            var client = McpClient.sync(transport).build();
            client.initialize(); // the chatbot is useless without its tools => refuse to start if the backend is down.
            return client;
        } catch (Exception e) {
            throw new RuntimeException(
                "The petclinic MCP server at " + url + " is unreachable — start the backend first.", e);
        }
    }

    /**
     * Stamps the service-account key on every request, plus the current user's JWT as an on-behalf-of
     * assertion when a chat turn is in flight. Package-visible + static so it is unit-testable in
     * isolation (build the request, read back its headers) without standing up the whole transport.
     */
    static void injectHeaders(HttpRequest.Builder builder, String apiKey) {
        builder.header("X-API-Key", apiKey); // the calling application (service account)
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof OwnerJwtPrincipal owner) {
            builder.header("Authorization", "Bearer " + owner.token()); // on-behalf-of this owner
        }
    }
}
