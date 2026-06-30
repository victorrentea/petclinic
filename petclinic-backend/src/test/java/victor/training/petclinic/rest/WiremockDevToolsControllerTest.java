package victor.training.petclinic.rest;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import victor.training.petclinic.rest.WiremockDevToolsController.WiremockStatus;

/**
 * End-to-end proof that the "Mock Server" tool actually works: boot the app, ask the dev-tools
 * controller to launch a real WireMock process from the Swagger examples, hit the live mock over
 * HTTP, and confirm it serves the hard-coded {@link ApiExamples}. Always stops the process.
 */
@AutoConfigureMockMvc
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
@ActiveProfiles("test")
class WiremockDevToolsControllerTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @Test
    void startsARealWireMockServingTheSwaggerExamples() throws Exception {
        WiremockStatus started = parse(mockMvc.perform(post("/api/devtools/wiremock/start"))
            .andReturn().getResponse().getContentAsString());
        try {
            assertThat(started.running()).isTrue();
            assertThat(started.port()).isPositive();
            assertThat(started.stubCount()).isGreaterThanOrEqualTo(6);

            String vets = httpGet(started.url() + "/api/vets");
            assertThat(vets).contains("Carter").contains("James");
        } finally {
            WiremockStatus stopped = parse(mockMvc.perform(post("/api/devtools/wiremock/stop"))
                .andReturn().getResponse().getContentAsString());
            assertThat(stopped.running()).isFalse();
        }
    }

    private WiremockStatus parse(String json) throws Exception {
        return objectMapper.readValue(json, WiremockStatus.class);
    }

    private static String httpGet(String url) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create(url)).GET().build();
        HttpResponse<String> response = HttpClient.newHttpClient()
            .send(request, HttpResponse.BodyHandlers.ofString());
        return response.body();
    }
}
