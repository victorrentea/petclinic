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
 * One shared connection, authenticated service-to-service by a static API key; the per-USER identity
 * (the browser JWT) is read from the Spring SecurityContext per request (see {@link #injectAuthHeaders}).
 *
 * <p>Transport: <b>Streamable HTTP</b> (MCP spec 2025-06-18) on the single {@code /mcp} endpoint —
 * replaces the deprecated HTTP+SSE client transport, matching the backend's Streamable server.
 *
 * <p><b>Why a per-request customizer and not {@code customizeRequest}.</b> mcp-core's
 * {@code customizeRequest(Consumer)} applies its consumer exactly
 * ONCE, at build/connect time, mutating a single shared {@code HttpRequest.Builder}
 * ({@code requestCustomizer.accept(requestBuilder)} in the builder). At that moment no chat turn is in
 * flight, so there is no authenticated user and NO {@code Authorization} header is ever attached to
 * outgoing tool-call POSTs — the backend then sees only the service principal. The correct per-request
 * hook is {@code httpRequestCustomizer(McpSyncHttpClientRequestCustomizer)}, whose {@code customize(...)}
 * the transport invokes for EVERY POST (in {@code sendHttpPost}) on the request's own thread, letting us
 * read the user from the SecurityContext at request time. We put BOTH headers here so the static key
 * still rides every request, including the startup handshake.
 */
@Configuration
class RemoteToolsConfig {

    @Bean
    McpSyncClient petclinicMcpClient(
        @Value("${petclinic.chatbot.mcp.url}") String url,
        @Value("${petclinic.chatbot.mcp.api-key}") String apiKey) {
        McpSyncHttpClientRequestCustomizer perRequestHeaders =
            (builder, method, endpoint, body, context) -> injectAuthHeaders(builder, apiKey);
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

    static void injectAuthHeaders(HttpRequest.Builder builder, String apiKey) {
        builder.header("X-API-Key", apiKey);
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof OwnerJwtPrincipal owner) {
            builder.header("Authorization", "Bearer " + owner.token());
        }
    }
}
