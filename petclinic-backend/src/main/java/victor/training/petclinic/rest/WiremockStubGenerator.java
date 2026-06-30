package victor.training.petclinic.rest;

import com.fasterxml.jackson.core.util.DefaultIndenter;
import com.fasterxml.jackson.core.util.DefaultPrettyPrinter;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectWriter;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Turns the response examples baked into {@code openapi.yaml} into WireMock stub mappings — the
 * PetClinic counterpart of the AI-workshop's {@code TrailStubGenerator}, generalized over every
 * endpoint that carries an example instead of the single {@code GET /trails}.
 *
 * <p>For each operation whose response declares an {@code application/json} example, it emits one
 * mapping of the shape WireMock expects:
 *
 * <pre>
 * { "request":  { "method": "GET", "urlPath": "/api/vets" },
 *   "response": { "status": 200, "headers": { "Content-Type": "application/json" }, "jsonBody": [ ... ] } }
 * </pre>
 *
 * <p>Because the example payloads live in {@link ApiExamples} (hard-coded Java) and flow into the
 * spec via springdoc, the mock can never drift from the documented contract.
 */
public final class WiremockStubGenerator {

    private static final YAMLMapper YAML = new YAMLMapper();
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final ObjectWriter PRETTY = JSON.writer(prettyPrinter());

    private static final List<String> HTTP_METHODS =
        List.of("get", "post", "put", "patch", "delete");

    private WiremockStubGenerator() {
    }

    /** One generated WireMock mapping, ready to be written to {@code mappings/<name>.json}. */
    public record Stub(String name, String method, String urlPath, int status, String json) {
    }

    /** Generates the stubs from an {@code openapi.yaml} file on disk. */
    public static List<Stub> generateFromFile(Path openApiYaml) throws IOException {
        return generate(Files.readString(openApiYaml));
    }

    /** Generates the stubs from the raw {@code openapi.yaml} content. */
    public static List<Stub> generate(String openApiYaml) throws IOException {
        JsonNode paths = YAML.readTree(openApiYaml).path("paths");
        List<Stub> stubs = new ArrayList<>();
        Iterator<Map.Entry<String, JsonNode>> pathEntries = paths.fields();
        while (pathEntries.hasNext()) {
            Map.Entry<String, JsonNode> pathEntry = pathEntries.next();
            String urlPath = pathEntry.getKey();
            for (String method : HTTP_METHODS) {
                JsonNode operation = pathEntry.getValue().path(method);
                if (operation.isMissingNode()) {
                    continue;
                }
                findExampleResponse(operation)
                    .ifPresent(found -> stubs.add(toStub(method, urlPath, found)));
            }
        }
        return stubs;
    }

    /** Locates the first response code that carries an {@code application/json} example. */
    private static Optional<ExampleResponse> findExampleResponse(JsonNode operation) {
        JsonNode responses = operation.path("responses");
        Iterator<Map.Entry<String, JsonNode>> responseEntries = responses.fields();
        while (responseEntries.hasNext()) {
            Map.Entry<String, JsonNode> responseEntry = responseEntries.next();
            JsonNode json = responseEntry.getValue().path("content").path("application/json");
            JsonNode example = extractExample(json);
            if (example != null) {
                int status = parseStatus(responseEntry.getKey());
                return Optional.of(new ExampleResponse(status, example));
            }
        }
        return Optional.empty();
    }

    /** Reads either {@code examples.<first>.value} (springdoc's {@code @ExampleObject}) or {@code example}. */
    private static JsonNode extractExample(JsonNode jsonContent) {
        JsonNode examples = jsonContent.path("examples");
        if (examples.isObject() && examples.size() > 0) {
            JsonNode firstValue = examples.elements().next().path("value");
            if (!firstValue.isMissingNode()) {
                return firstValue;
            }
        }
        JsonNode single = jsonContent.path("example");
        return single.isMissingNode() ? null : single;
    }

    private static Stub toStub(String method, String urlPath, ExampleResponse found) {
        ObjectNode request = JSON.createObjectNode();
        request.put("method", method.toUpperCase());
        request.put("urlPath", urlPath);

        ObjectNode headers = JSON.createObjectNode();
        headers.put("Content-Type", "application/json");

        ObjectNode response = JSON.createObjectNode();
        response.put("status", found.status());
        response.set("headers", headers);
        response.set("jsonBody", found.example());

        ObjectNode mapping = JSON.createObjectNode();
        mapping.set("request", request);
        mapping.set("response", response);

        try {
            return new Stub(stubName(method, urlPath), method.toUpperCase(), urlPath, found.status(),
                PRETTY.writeValueAsString(mapping));
        } catch (IOException e) {
            throw new IllegalStateException("Cannot serialize stub for " + method + " " + urlPath, e);
        }
    }

    /** {@code GET /api/vets} → {@code get-api-vets} (a filesystem- and URL-safe stub name). */
    private static String stubName(String method, String urlPath) {
        String slug = urlPath.replaceAll("[^a-zA-Z0-9]+", "-").replaceAll("(^-|-$)", "");
        return method.toLowerCase() + "-" + slug;
    }

    private static int parseStatus(String responseCode) {
        try {
            return Integer.parseInt(responseCode);
        } catch (NumberFormatException e) {
            return 200; // "default" or non-numeric codes
        }
    }

    private static DefaultPrettyPrinter prettyPrinter() {
        DefaultIndenter indenter = new DefaultIndenter("  ", "\n");
        DefaultPrettyPrinter printer = new DefaultPrettyPrinter();
        printer.indentObjectsWith(indenter);
        printer.indentArraysWith(indenter);
        return printer;
    }

    private record ExampleResponse(int status, JsonNode example) {
    }
}
