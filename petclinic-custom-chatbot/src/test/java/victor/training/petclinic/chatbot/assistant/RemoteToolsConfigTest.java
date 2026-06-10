package victor.training.petclinic.chatbot.assistant;

import java.net.URI;
import java.net.http.HttpRequest;
import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pure unit test for {@link RemoteToolsConfig#injectHeaders}. No Spring context: the
 * {@link SecurityContextHolder} is driven directly so each request's two transport headers
 * (the static service-account {@code X-API-Key} and the per-call on-behalf-of
 * {@code Authorization: Bearer <jwt>}) can be asserted in isolation.
 */
class RemoteToolsConfigTest {

  @AfterEach
  void clearSecurityContext() {
    SecurityContextHolder.clearContext();
  }

  @Test
  void attaches_service_key_and_user_bearer_when_owner_authenticated() {
    var owner = new OwnerJwtPrincipal(1, "George", "g@x.com", "jwt-token-abc");
    SecurityContextHolder.getContext().setAuthentication(
        new UsernamePasswordAuthenticationToken(owner, null, List.of()));

    var builder = HttpRequest.newBuilder(URI.create("http://localhost:8080/mcp"));
    RemoteToolsConfig.injectHeaders(builder, "test-key");
    HttpRequest req = builder.build();

    assertThat(req.headers().firstValue("X-API-Key")).hasValue("test-key");
    assertThat(req.headers().firstValue("Authorization")).hasValue("Bearer jwt-token-abc");
  }

  @Test
  void attaches_only_service_key_when_no_user_in_context() {
    // Boot/handshake case: no chat turn in flight, so no owner JWT to forward.
    var builder = HttpRequest.newBuilder(URI.create("http://localhost:8080/mcp"));
    RemoteToolsConfig.injectHeaders(builder, "test-key");
    HttpRequest req = builder.build();

    assertThat(req.headers().firstValue("X-API-Key")).hasValue("test-key");
    assertThat(req.headers().firstValue("Authorization")).isEmpty();
  }

  @Test
  void attaches_only_service_key_when_principal_is_not_owner() {
    SecurityContextHolder.getContext().setAuthentication(
        new UsernamePasswordAuthenticationToken("some-service", null, List.of()));

    var builder = HttpRequest.newBuilder(URI.create("http://localhost:8080/mcp"));
    RemoteToolsConfig.injectHeaders(builder, "test-key");
    HttpRequest req = builder.build();

    assertThat(req.headers().firstValue("X-API-Key")).hasValue("test-key");
    assertThat(req.headers().firstValue("Authorization")).isEmpty();
  }
}
