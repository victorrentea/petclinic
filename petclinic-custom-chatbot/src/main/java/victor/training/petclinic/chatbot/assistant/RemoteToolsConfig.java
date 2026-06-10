package victor.training.petclinic.chatbot.assistant;

import java.net.http.HttpRequest;

import io.modelcontextprotocol.client.McpClient;
import io.modelcontextprotocol.client.McpSyncClient;
import io.modelcontextprotocol.client.transport.HttpClientSseClientTransport;
import io.modelcontextprotocol.client.transport.customizer.McpSyncHttpClientRequestCustomizer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * Wires the MCP <b>client</b> that calls the remote petclinic MCP server (the backend) for its tools.
 * One shared connection, authenticated service-to-service by a static API key; the per-USER identity
 * (the browser JWT) is read from the Spring SecurityContext per request (see {@link #injectAuthHeaders}).
 *
 * <p><b>Why a per-request customizer and not {@code customizeRequest}.</b> mcp-core 0.18.2's
 * {@code HttpClientSseClientTransport.Builder.customizeRequest(Consumer)} applies its consumer exactly
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
    var transport = HttpClientSseClientTransport.builder(url)
        .sseEndpoint("/mcp")
        // Per-REQUEST hook: invoked on every outgoing POST, so the in-flight user's token is read now,
        // not frozen at connect-time (when it is still null). See class javadoc.
        .httpRequestCustomizer(perRequestHeaders)
        .build();
    var client = McpClient.sync(transport).build();
    // Fail fast: the chatbot is useless without its tools, so refuse to start if the backend is down.
    try {
      client.initialize();
    } catch (Exception e) {
      throw new RuntimeException(
          "The petclinic MCP server at " + url + " is unreachable — start the backend first.", e);
    }
    return client;
  }

  /**
   * Adds the auth headers to a single outgoing tool-call POST. Static and side-effect-only so it can be
   * unit-tested against a real {@link HttpRequest.Builder} without a live backend.
   * <ul>
   *   <li><b>X-API-Key</b> — static SERVICE credential authenticating THIS chatbot to the MCP server;
   *       sent on every request, including the startup handshake.</li>
   *   <li><b>Authorization: Bearer</b> — the in-flight USER's JWT, read from the Spring SecurityContext
   *       AT request time so the backend resolves the right owner from its {@code sub}. Absent (header
   *       skipped) when no chat turn is in flight, e.g. the startup handshake.</li>
   * </ul>
   */
  static void injectAuthHeaders(HttpRequest.Builder builder, String apiKey) {
    builder.header("X-API-Key", apiKey);
    // The blocking tool-call POST runs on the request's own (virtual) thread, where Spring Security's
    // ThreadLocal context is still populated — so read the in-flight user straight from it. Per-thread,
    // so concurrent chats never clobber each other. Absent on the startup handshake / SSE setup (no user
    // → no Authorization header, only the service key), which is exactly right for those service calls.
    var auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth != null && auth.getPrincipal() instanceof OwnerJwtPrincipal owner) {
      builder.header("Authorization", "Bearer " + owner.token());
    }
  }
}
