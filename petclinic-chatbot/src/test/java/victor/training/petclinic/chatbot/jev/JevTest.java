package victor.training.petclinic.chatbot.jev;

import static org.assertj.core.api.Assertions.assertThat;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import victor.training.petclinic.chatbot.jev.JevTriageController.Specialty;

class JevTest {

    private HttpServer server;
    private String lastRequest;

    @AfterEach
    void stop() {
        server.stop(0);
    }

    @Test
    void choose_returnsTheEnumConstant() throws IOException {
        Jev jev = jevAnswering("""
                {"answers": {"q": {"type": "choice", "choice": "SURGERY", "confidence": 0.8}}}""");

        assertThat(jev.choose("swallowed a sock", "Which specialty?", Specialty.class)).isEqualTo(Specialty.SURGERY);
        assertThat(lastRequest).contains("\"type\":\"choice\"", "\"RADIOLOGY\"", "\"DENTISTRY\"", "swallowed a sock");
    }

    @Test
    void probability_returnsTheNoul_alsoWhenAnswersAreAtTheRoot() throws IOException {
        Jev jev = jevAnswering("""
                {"q": {"type": "noul", "noul": 0.95}}""");

        assertThat(jev.probability("bleeding a lot", "Emergency?")).isEqualTo(0.95);
        assertThat(lastRequest).contains("\"type\":\"noul\"");
    }

    private Jev jevAnswering(String json) throws IOException {
        server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        server.createContext("/decide", exchange -> {
            lastRequest = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            byte[] body = json.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        return new Jev("http://localhost:" + server.getAddress().getPort() + "/decide", "test-key");
    }
}
