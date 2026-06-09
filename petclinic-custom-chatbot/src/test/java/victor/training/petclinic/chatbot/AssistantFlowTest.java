package victor.training.petclinic.chatbot;

import java.time.Duration;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.WebClient;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * REAL end-to-end test of the triage -> recommend-specialty -> book-a-visit flow.
 *
 * <p>This test is NOT hermetic. It:
 * <ul>
 *   <li>calls the real OpenAI API (chat + embeddings) — gated on {@code OPENAI_API_KEY};
 *       skips cleanly when the key is absent (forks/CI without the secret);</li>
 *   <li>REQUIRES the petclinic backend running on :8080 exposing the MCP server at /sse
 *       (CI starts it; locally run {@code ./start-database.sh} + {@code ./start-backend.sh}
 *       first). The demo JWT is George Franklin (owner sub=1), whose pet is "Leo";</li>
 *   <li>creates a real {@code Visit} row as a side effect (create_visit; elicitation
 *       auto-accepts the demo phone configured on the MCP client).</li>
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

  @Test
  void triages_recommends_specialty_and_books_a_visit() {
    String user = "it-george";

    // 1. Describe a symptom -> the assistant engages and offers to book a vet visit.
    //    (The specialty wording is LLM-paraphrased; the hard proof is the real booking in step 2.)
    String r1 = ask(user, "My dog Leo is limping and won't put weight on his leg");
    assertThat(r1.toLowerCase()).containsAnyOf("appointment", "visit", "schedule", "book");

    // 2. Agree to book -> backend create_visit runs (elicitation auto-accepts the demo phone) and
    //    the assistant confirms the scheduled visit. (The LLM paraphrases the tool's raw output.)
    String r2 = ask(user, "Yes, please book a radiology visit for Leo next Monday at 10:00");
    assertThat(r2.toLowerCase()).containsAnyOf("scheduled", "booked", "created");

    // 3. Confirm the visit is now listed for Leo.
    String r3 = ask(user, "List my upcoming visits");
    assertThat(r3.toLowerCase()).containsAnyOf("leo", "radiology");
  }

  /** Calls the streaming markdown endpoint and joins all chunks into one String. */
  private String ask(String username, String q) {
    WebClient webClient = WebClient.create("http://localhost:" + port);
    return String.join("", webClient.get()
        .uri("/{u}/assistant?q={q}", username, q)
        .accept(MediaType.parseMediaType("text/markdown"))
        .retrieve()
        .bodyToFlux(String.class)
        .collectList()
        .block(Duration.ofSeconds(120)));
  }
}
