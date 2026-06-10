package victor.training.petclinic.chatbot.assistant;

import java.net.URI;
import java.net.http.HttpRequest;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit test for the PER-REQUEST header injection that propagates the static service key AND the
 * in-flight user's Bearer JWT to each MCP tool-call POST. It exercises the exact customizer the
 * transport invokes on every request ({@code McpSyncHttpClientRequestCustomizer.customize}), proving
 * the token is read AT request time from the {@link SecurityContextHolder} — populated on the request
 * thread, absent (no header) for connect-time/SSE service calls.
 */
class RemoteToolsConfigTest {

  private static final String API_KEY = "pc-mcp-test-key";

  @AfterEach
  void clearContext() {
    SecurityContextHolder.clearContext();
  }

  @Test
  void always_sends_the_static_service_api_key() {
    HttpRequest request = customize();

    assertThat(header(request, "X-API-Key")).contains(API_KEY);
  }

  @Test
  void propagates_the_in_flight_users_bearer_read_from_the_security_context() {
    authenticate(new OwnerJwtPrincipal(1, "George Franklin", "george@petclinic.example", "user-jwt-123"));

    HttpRequest request = customize();

    assertThat(header(request, "Authorization")).contains("Bearer user-jwt-123");
  }

  @Test
  void omits_the_authorization_header_when_no_user_is_authenticated() {
    // e.g. the startup handshake / SSE setup — no user in flight, only the service key rides along.
    HttpRequest request = customize();

    assertThat(header(request, "Authorization")).isEmpty();
  }

  private static void authenticate(OwnerJwtPrincipal owner) {
    SecurityContextHolder.getContext().setAuthentication(
        new UsernamePasswordAuthenticationToken(owner, null, List.of()));
  }

  /** Runs the production per-request customizer against a real builder and returns the built request. */
  private static HttpRequest customize() {
    var builder = HttpRequest.newBuilder(URI.create("http://localhost:8080/mcp"))
        .POST(HttpRequest.BodyPublishers.ofString("{}"));
    RemoteToolsConfig.injectAuthHeaders(builder, API_KEY);
    return builder.build();
  }

  private static Optional<String> header(HttpRequest request, String name) {
    List<String> values = request.headers().allValues(name);
    if (values.isEmpty()) {
      return Optional.empty();
    }
    return Optional.of(values.get(0));
  }
}
