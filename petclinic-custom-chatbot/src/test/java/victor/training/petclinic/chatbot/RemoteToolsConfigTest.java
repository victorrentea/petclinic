package victor.training.petclinic.chatbot;

import java.net.URI;
import java.net.http.HttpRequest;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit test for the PER-REQUEST header injection that propagates the static service key AND the
 * in-flight user's Bearer JWT to each MCP tool-call POST. It exercises the exact customizer the
 * transport invokes on every request ({@code McpSyncHttpClientRequestCustomizer.customize}), proving
 * the token is read AT request time (not frozen at connect time, when it is still null).
 */
class RemoteToolsConfigTest {

  private static final String API_KEY = "pc-mcp-test-key";

  @AfterEach
  void clearToken() {
    BearerTokenContext.clear();
  }

  @Test
  void always_sends_the_static_service_api_key() {
    HttpRequest request = customize();

    assertThat(header(request, "X-API-Key")).contains(API_KEY);
  }

  @Test
  void propagates_the_in_flight_user_bearer_token_read_at_request_time() {
    // Connect-time state is null; the token is published only once the chat turn is running.
    BearerTokenContext.set("user-jwt-123");

    HttpRequest request = customize();

    assertThat(header(request, "Authorization")).contains("Bearer user-jwt-123");
  }

  @Test
  void omits_the_authorization_header_when_no_user_token_is_present() {
    // e.g. the startup handshake — no user in flight.
    HttpRequest request = customize();

    assertThat(header(request, "Authorization")).isEmpty();
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
