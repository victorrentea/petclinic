package victor.training.petclinic.chatbot;

import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import io.modelcontextprotocol.spec.McpSchema.ElicitRequest;
import io.modelcontextprotocol.spec.McpSchema.ElicitResult;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Deterministic unit test for the elicitation registry — no OpenAI, no MCP server. Proves that a
 * blocking elicitation callback parks on a future, an SSE event is emitted for the owner, and that
 * answering it (submit) resumes the parked callback with an ACCEPT carrying the submitted value.
 */
class PendingElicitationsTest {

  private final PendingElicitations registry = new PendingElicitations();

  @Test
  void submitting_a_phone_resumes_the_parked_callback_with_accept() throws Exception {
    String owner = "george";
    ElicitRequest request = new ElicitRequest("Please share your phone", null);

    // The browser subscribes to its SSE channel FIRST (like the page does at load), then waits.
    CompletableFuture<PendingElicitations.Event> firstEvent = registry.events(owner).next().toFuture();

    // The elicitation callback blocks on a background thread, just like the MCP boundedElastic worker.
    CompletableFuture<ElicitResult> parked = CompletableFuture.supplyAsync(
        () -> registry.await(owner, request, Duration.ofSeconds(5)),
        Executors.newSingleThreadExecutor());

    // The browser learns about it over SSE: one event addressed to this owner.
    PendingElicitations.Event event = firstEvent.get(2, TimeUnit.SECONDS);
    assertThat(event).isNotNull();
    assertThat(event.prompt()).contains("phone");
    assertThat(event.field()).isEqualTo("phone");

    // The browser POSTs the answer keyed by the event id -> the parked callback wakes up.
    boolean accepted = registry.submit(owner, event.id(), "0744123456");
    assertThat(accepted).isTrue();

    ElicitResult result = parked.get(2, TimeUnit.SECONDS);
    assertThat(result.action()).isEqualTo(ElicitResult.Action.ACCEPT);
    assertThat(result.content()).containsEntry("phone", "0744123456");
  }

  @Test
  void timing_out_resumes_the_callback_with_decline() {
    String owner = "nobody-answers";
    ElicitRequest request = new ElicitRequest("Please share your phone", null);

    ElicitResult result = registry.await(owner, request, Duration.ofMillis(50));

    assertThat(result.action()).isEqualTo(ElicitResult.Action.DECLINE);
  }

  @Test
  void submit_for_an_unknown_id_returns_false() {
    assertThat(registry.submit("george", "does-not-exist", "0744123456")).isFalse();
  }

  @Test
  void one_owner_cannot_answer_another_owners_elicitation() throws Exception {
    String owner = "george";
    ElicitRequest request = new ElicitRequest("Please share your phone", null);

    CompletableFuture<PendingElicitations.Event> firstEvent = registry.events(owner).next().toFuture();
    CompletableFuture<ElicitResult> parked = CompletableFuture.supplyAsync(
        () -> registry.await(owner, request, Duration.ofMillis(300)),
        Executors.newSingleThreadExecutor());
    PendingElicitations.Event event = firstEvent.get(2, TimeUnit.SECONDS);

    // A DIFFERENT owner tries to answer george's elicitation -> rejected, george's future not completed.
    assertThat(registry.submit("mallory", event.id(), "0000000000")).isFalse();

    // george's elicitation therefore times out and declines (was never answered).
    assertThat(parked.get(2, TimeUnit.SECONDS).action()).isEqualTo(ElicitResult.Action.DECLINE);
  }
}
