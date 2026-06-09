package victor.training.petclinic.chatbot;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.Disposable;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * REAL end-to-end test of the triage -> recommend-specialty -> book-a-visit flow.
 *
 * <p>This test is NOT hermetic. It:
 * <ul>
 *   <li>calls the real OpenAI API (chat + embeddings) — gated on {@code OPENAI_API_KEY};
 *       skips cleanly when the key is absent (forks/CI without the secret);</li>
 *   <li>REQUIRES the petclinic backend running on :8080 exposing the MCP server at /mcp
 *       (CI starts it; locally run {@code ./start-database.sh} + {@code ./start-backend.sh}
 *       first). The demo JWT is George Franklin (owner sub=1), whose pet is "Leo";</li>
 *   <li>creates a real {@code Visit} row as a side effect (create_visit elicits the owner's phone;
 *       a stand-in "browser" subscribed to the elicitation channel submits the demo phone).</li>
 * </ul>
 *
 * <p>LLM output is non-deterministic, so assertions only check for key substrings.
 *
 * <p>The app uses an in-memory SimpleVectorStore by default, so no Postgres/Docker is required.
 *
 * <p>Named {@code *Test} (not {@code *IT}) on purpose: this project has no failsafe plugin and
 * runs everything under surefire via {@code mvn test} — matching the backend's convention.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@EnabledIfEnvironmentVariable(named = "OPENAI_API_KEY", matches = ".+")
class AssistantFlowTest {

  @LocalServerPort
  int port;

  @Autowired
  PendingElicitations elicitations;

  @Test
  void triages_recommends_specialty_and_books_a_visit() {
    String user = "it-george";
    Disposable browser = autoAnswerPhone(user); // stand in for the human at the browser

    // 1. Describe a symptom -> the assistant engages and offers to book a vet visit.
    //    (The specialty wording is LLM-paraphrased; the hard proof is the real booking in step 2.)
    String r1 = ask(user, "My dog Leo is limping and won't put weight on his leg");
    assertThat(r1.toLowerCase()).containsAnyOf("appointment", "visit", "schedule", "book");

    // 2. Agree to book -> backend create_visit runs. It elicits the owner's phone, which our
    //    auto-answering browser supplies, so the visit is booked and the assistant confirms it.
    String r2 = ask(user, "Yes, please book a radiology visit for Leo next Monday at 10:00");
    browser.dispose();
    assertThat(r2.toLowerCase()).containsAnyOf("scheduled", "booked", "created");

    // 3. Confirm the visit is now listed for Leo.
    String r3 = ask(user, "List my upcoming visits");
    assertThat(r3.toLowerCase()).containsAnyOf("leo", "radiology");
  }

  @Test
  void remembers_context_across_human_messages() {
    String user = "memory-demo";
    // State a fact the model can't otherwise know...
    ask(user, "My dog's name is Pixel, and he is a husky.");
    // ...then ask for it back: only the per-conversation memory can answer this.
    String answer = ask(user, "What is my dog's name?");
    assertThat(answer.toLowerCase()).contains("pixel");
  }

  @Test
  void books_a_visit_relative_to_now_using_the_clock_tool() {
    String user = "clock-demo";
    Disposable browser = autoAnswerPhone(user); // stand in for the human at the browser
    ask(user, "My dog Leo is limping and won't put weight on his leg.");
    // "one hour from now" only resolves to a valid FUTURE time if the assistant asks the clock tool.
    String r = ask(user, "Yes, book a radiology visit for Leo one hour from now.");
    browser.dispose();
    assertThat(r.toLowerCase()).containsAnyOf("scheduled", "booked", "created");
  }

  /**
   * Stand-in for the human at the browser: subscribe to this owner's elicitation SSE channel and
   * immediately submit the demo phone whenever create_visit asks for one — so the booking flow
   * completes without a real UI. Dispose it when done.
   */
  private Disposable autoAnswerPhone(String user) {
    return elicitations.events(user)
        .subscribe(event -> elicitations.submit(user, event.id(), "0744123456"));
  }

  /** Calls the streaming markdown endpoint and joins all chunks into one String. */
  private String ask(String username, String message) {
    WebClient webClient = WebClient.create("http://localhost:" + port);
    return String.join("", webClient.get()
        .uri("/assistant?message={m}", message)
        // Identity now travels in the Bearer token (SecurityConfig parses it); the name claim both
        // labels the owner and isolates per-conversation memory, like the old path username did.
        .header("Authorization", "Bearer " + demoJwt(username))
        .accept(MediaType.parseMediaType("text/markdown"))
        .retrieve()
        .bodyToFlux(String.class)
        .collectList()
        .block(Duration.ofSeconds(120)));
  }

  /** A JWT with a throw-away (never-verified) signature — the app only reads the payload claims. */
  private static String demoJwt(String username) {
    String header = base64Url("{\"alg\":\"HS256\",\"typ\":\"JWT\"}");
    String payload = base64Url(
        "{\"name\":\"" + username + "\",\"email\":\"" + username + "@petclinic.example\"}");
    return header + "." + payload + ".c2ln"; // dummy base64url signature, not validated
  }

  private static String base64Url(String json) {
    return Base64.getUrlEncoder().withoutPadding().encodeToString(json.getBytes(StandardCharsets.UTF_8));
  }
}
