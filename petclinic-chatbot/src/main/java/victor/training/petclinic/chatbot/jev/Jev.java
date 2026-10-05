package victor.training.petclinic.chatbot.jev;

import static java.util.stream.Collectors.toMap;
import static org.springframework.http.MediaType.APPLICATION_JSON;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Arrays;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Typed facade over Jev (TypeSafe AI): it returns decisions, never text.
 * Callers see only Java types; the JSON and the HTTP call stay in the helpers at the bottom.
 */
@Component
public class Jev {

    private final RestClient http;

    Jev(@Value("${petclinic.chatbot.jev.url}") String url, @Value("${petclinic.chatbot.jev.api-key}") String apiKey) {
        this.http = RestClient.builder()
                .baseUrl(url)
                .defaultHeader("Authorization", "Bearer " + apiKey)
                .build();
    }

    /** Picks one constant of your enum. */
    public <E extends Enum<E>> E choose(String state, String question, Class<E> options) {
        Map<String, String> criteria = Arrays.stream(options.getEnumConstants())
                .collect(toMap(Enum::name, Enum::name));
        JsonNode answer = ask(state, Map.of("type", "choice", "instructions", question, "criteria", criteria));
        return Enum.valueOf(options, answer.get("choice").asText());
    }

    /** Calibrated probability (0..1) that the answer is yes: 0.9 is right ~90% of the time. */
    public double probability(String state, String question) {
        JsonNode answer = ask(state, Map.of("type", "noul", "instructions", question));
        return answer.get("noul").asDouble();
    }

    // ---------- below: the actual hit, hidden from callers ----------

    // POST {"state": "...", "questions": {"q": {...}}}  →  {"answers": {"q": {"type": ..., "choice"|"noul": ...}}}
    private JsonNode ask(String state, Map<String, Object> question) {
        JsonNode response = http.post()
                .contentType(APPLICATION_JSON)
                .body(Map.of("state", state, "questions", Map.of("q", question)))
                .retrieve()
                .body(JsonNode.class);
        return answers(response).get("q");
    }

    // The hosted route wraps the answers in "answers"; the official/gateway routes return them at the root.
    private static JsonNode answers(JsonNode response) {
        return response.has("answers") ? response.get("answers") : response;
    }
}
