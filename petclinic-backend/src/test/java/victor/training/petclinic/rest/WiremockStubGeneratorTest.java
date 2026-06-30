package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import victor.training.petclinic.rest.WiremockStubGenerator.Stub;

/**
 * Verifies that the hard-coded {@link ApiExamples} survive the round-trip through {@code openapi.yaml}
 * and come back out as valid WireMock stubs. Pure unit test — reads the committed spec from disk, no
 * Spring context. If a new GET-list example is added (or removed), update {@link #EXPECTED_PATHS}.
 */
class WiremockStubGeneratorTest {

    private static final Path OPENAPI = Path.of("../openapi.yaml");
    private static final ObjectMapper JSON = new ObjectMapper();

    private static final List<String> EXPECTED_PATHS = List.of(
        "/api/owners", "/api/pets", "/api/pettypes", "/api/specialties", "/api/vets", "/api/visits");

    @Test
    void generatesAStubForEveryExampleEndpoint() throws Exception {
        List<Stub> stubs = WiremockStubGenerator.generateFromFile(OPENAPI);

        Map<String, Stub> byPath = stubs.stream()
            .collect(Collectors.toMap(Stub::urlPath, s -> s, (a, b) -> a));
        assertThat(byPath.keySet()).containsAll(EXPECTED_PATHS);
    }

    @Test
    void vetsStubIsAValidWireMockMappingServingTheExampleArray() throws Exception {
        Stub vets = WiremockStubGenerator.generateFromFile(OPENAPI).stream()
            .filter(s -> s.urlPath().equals("/api/vets"))
            .findFirst().orElseThrow();

        assertThat(vets.method()).isEqualTo("GET");
        assertThat(vets.status()).isEqualTo(200);

        JsonNode mapping = JSON.readTree(vets.json());
        assertThat(mapping.at("/request/method").asText()).isEqualTo("GET");
        assertThat(mapping.at("/request/urlPath").asText()).isEqualTo("/api/vets");
        assertThat(mapping.at("/response/status").asInt()).isEqualTo(200);
        assertThat(mapping.at("/response/headers/Content-Type").asText()).isEqualTo("application/json");

        JsonNode body = mapping.at("/response/jsonBody");
        assertThat(body.isArray()).isTrue();
        assertThat(body.get(0).get("firstName").asText()).isEqualTo("James");
    }
}
