package victor.training.petclinic.mcp;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * END-TO-END elicitation over the real <b>Streamable HTTP</b> transport, at the HTTP level:
 * {@code call_vet_ambulance} pauses mid-call to ask the human for an address, and the client answers on a
 * SEPARATE {@code POST /mcp}.
 *
 * <p>The tool result is then written on the ORIGINAL request's SSE stream, which Spring MVC closes via an
 * ASYNC dispatch. That dispatch runs the security filter chain again; when it is not re-authenticated,
 * {@code AuthorizationFilter} denies it after the response was committed and Tomcat aborts the connection
 * without the final chunk. The result bytes may already be on the wire, but the stream ends in a socket
 * error — Claude Code reports it as "transport dropped mid-call; response ... was lost". The Java MCP
 * client silently tolerates the abort, so this test reads the raw stream to the end instead.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
class McpElicitationRoundTripTest {

    private static final Pattern ELICITATION_ID = Pattern
            .compile("\"method\":\"elicitation/create\",\"id\":\"([^\"]+)\"");

    @LocalServerPort
    int port;

    @Value("${petclinic.mcp.api-key}")
    String apiKey;

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private String sessionId;

    @Test
    void accepted_elicitation_returns_the_result_and_closes_the_stream_cleanly() throws Exception {
        List<String> stream = callAmbulanceAnswering("""
                {"action":"accept","content":{"address":"671 Lincoln Ave, Winnetka"}}""");

        assertThat(stream).anyMatch(line -> line.contains("\"id\":7,\"result\"")
                && line.contains("Vet ambulance dispatched to 671 Lincoln Ave, Winnetka"));
    }

    @Test
    void declined_elicitation_returns_the_result_and_closes_the_stream_cleanly() throws Exception {
        List<String> stream = callAmbulanceAnswering("""
                {"action":"decline"}""");

        assertThat(stream).anyMatch(line -> line.contains("Vet ambulance was not requested."));
    }

    /** Opens the tools/call stream, answers its elicitation on a second POST, then reads the stream to EOF. */
    private List<String> callAmbulanceAnswering(String elicitResult) throws Exception {
        HttpResponse<String> init = post("""
                {"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"2025-06-18",
                "capabilities":{"elicitation":{}},"clientInfo":{"name":"test","version":"1"}}}""");
        sessionId = init.headers().firstValue("Mcp-Session-Id").orElseThrow();
        post("""
                {"jsonrpc":"2.0","method":"notifications/initialized"}""");

        HttpResponse<InputStream> call = http.send(request("""
                {"jsonrpc":"2.0","id":7,"method":"tools/call",
                "params":{"name":"call_vet_ambulance","arguments":{}}}"""), HttpResponse.BodyHandlers.ofInputStream());
        List<String> lines = new ArrayList<>();
        assertThatCode(() -> readToEndAnswering(call.body(), elicitResult, lines))
                .as("the tools/call SSE stream must end cleanly, not be aborted mid-response; got %s", lines)
                .doesNotThrowAnyException();
        return lines;
    }

    private void readToEndAnswering(InputStream sse, String elicitResult, List<String> lines) throws Exception {
        try (var reader = new BufferedReader(new InputStreamReader(sse, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                lines.add(line);
                Matcher elicitation = ELICITATION_ID.matcher(line);
                if (elicitation.find()) {
                    HttpResponse<String> answer = post("""
                            {"jsonrpc":"2.0","id":"%s","result":%s}""".formatted(elicitation.group(1), elicitResult));
                    assertThat(answer.statusCode()).isEqualTo(202);
                }
            }
        }
    }

    private HttpResponse<String> post(String json) throws Exception {
        return http.send(request(json), HttpResponse.BodyHandlers.ofString());
    }

    private HttpRequest request(String json) {
        var builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/mcp"))
                .timeout(Duration.ofSeconds(10))
                .header("X-API-Key", apiKey)
                .header("Authorization", "Bearer " + jwtForOwner(1))
                .header("Content-Type", "application/json")
                .header("Accept", "application/json, text/event-stream")
                .POST(HttpRequest.BodyPublishers.ofString(json));
        if (sessionId != null) {
            builder.header("Mcp-Session-Id", sessionId).header("MCP-Protocol-Version", "2025-06-18");
        }
        return builder.build();
    }

    /** A JWT the backend accepts: it base64-decodes the payload (no signature check) and reads {@code sub}. */
    private static String jwtForOwner(int ownerId) {
        return base64Url("{\"alg\":\"HS256\",\"typ\":\"JWT\"}")
                + "." + base64Url("{\"sub\":\"" + ownerId + "\"}")
                + ".sig";
    }

    private static String base64Url(String json) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(json.getBytes(StandardCharsets.UTF_8));
    }
}
