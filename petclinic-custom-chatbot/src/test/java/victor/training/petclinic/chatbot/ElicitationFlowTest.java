package victor.training.petclinic.chatbot;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import io.modelcontextprotocol.spec.McpSchema.ElicitRequest;
import io.modelcontextprotocol.spec.McpSchema.ElicitResult;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.scheduler.Schedulers;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Deterministic web-layer test (NO OpenAI, NO MCP server): proves a parked elicitation is delivered
 * to the authenticated owner over the SSE side-channel, and that POSTing the phone resumes the
 * blocked callback with an ACCEPT carrying that phone. Auth on the SSE connect travels as a JWT
 * query param (EventSource can't set headers); the POST uses the normal Bearer header.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ElicitationFlowTest {

  @Autowired
  WebTestClient web;

  @Autowired
  PendingElicitations registry;

  @Test
  void parked_elicitation_is_delivered_over_sse_then_completed_by_a_phone_post() throws Exception {
    String owner = "george";
    String jwt = demoJwt(owner);

    // Simulate the MCP callback parking on the boundedElastic worker. Park after a short delay so the
    // page's SSE subscription (below) is connected first — the channel is multicast with no replay,
    // exactly like the real page that subscribes at load before any chat happens.
    ElicitRequest request = new ElicitRequest("Please share your contact phone", null);
    CompletableFuture<ElicitResult> parked = new CompletableFuture<>();
    Schedulers.boundedElastic().schedule(
        () -> parked.complete(registry.await(owner, request, Duration.ofSeconds(10))),
        300, TimeUnit.MILLISECONDS);

    // The browser subscribes to its own SSE channel (JWT as query param) and receives the event.
    PendingElicitations.Event event = web.get()
        .uri("/elicitations?token={t}", jwt)
        .accept(MediaType.TEXT_EVENT_STREAM)
        .exchange()
        .expectStatus().isOk()
        .returnResult(PendingElicitations.Event.class)
        .getResponseBody()
        .blockFirst(Duration.ofSeconds(5));
    assertThat(event).isNotNull();
    assertThat(event.field()).isEqualTo("phone");
    assertThat(event.prompt()).contains("phone");

    // The browser POSTs the phone for that event id -> the parked callback resumes with ACCEPT.
    web.post()
        .uri("/elicitations/{id}", event.id())
        .header("Authorization", "Bearer " + jwt)
        .bodyValue("0744123456")
        .exchange()
        .expectStatus().isOk();

    ElicitResult result = parked.get(5, TimeUnit.SECONDS);
    assertThat(result.action()).isEqualTo(ElicitResult.Action.ACCEPT);
    assertThat(result.content()).containsEntry("phone", "0744123456");
  }

  @Test
  void sse_connect_without_a_token_is_unauthorized() {
    web.get()
        .uri("/elicitations")
        .accept(MediaType.TEXT_EVENT_STREAM)
        .exchange()
        .expectStatus().isUnauthorized();
  }

  /** A JWT with a throw-away (never-verified) signature — the app only reads the payload claims. */
  private static String demoJwt(String username) {
    String header = base64Url("{\"alg\":\"HS256\",\"typ\":\"JWT\"}");
    String payload = base64Url(
        "{\"name\":\"" + username + "\",\"email\":\"" + username + "@petclinic.example\"}");
    return header + "." + payload + ".c2ln";
  }

  private static String base64Url(String json) {
    return Base64.getUrlEncoder().withoutPadding().encodeToString(json.getBytes(StandardCharsets.UTF_8));
  }
}
