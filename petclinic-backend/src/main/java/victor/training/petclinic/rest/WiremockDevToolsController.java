package victor.training.petclinic.rest;

import io.swagger.v3.oas.annotations.Hidden;
import java.io.IOException;
import java.net.ServerSocket;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import victor.training.petclinic.rest.WiremockStubGenerator.Stub;

/**
 * Dev-only tool that brings the AI-workshop's "examples → live mock" trick into PetClinic: it
 * reads the response examples from the generated {@code openapi.yaml}, turns them into WireMock
 * stubs ({@link WiremockStubGenerator}), and boots a <b>real</b> WireMock standalone process via a
 * shell command on a free port — so the documented examples become a live backend you can curl.
 *
 * <p>Driven from the frontend "Mock Server" screen. Hidden from the OpenAPI contract ({@link Hidden})
 * because it is a developer convenience, not part of the published API.
 */
@Hidden
@Slf4j
@RestController
@RequestMapping("/api/devtools/wiremock")
public class WiremockDevToolsController {

    /** Matches the {@code wiremock.version} property in pom.xml (jar copied to target/wiremock). */
    private static final String WIREMOCK_VERSION = "3.9.1";
    private static final HttpClient HTTP = HttpClient.newHttpClient();

    @Value("${petclinic.devtools.wiremock.openapi-path:../openapi.yaml}")
    private String openApiPath;

    @Value("${petclinic.devtools.wiremock.jar:}")
    private String configuredJar;

    private Process process;
    private int port;
    private Path workDir;
    private String command;

    /** A snapshot of the mock server's state, returned by every endpoint. */
    public record WiremockStatus(boolean running, Integer port, String url, String command, int stubCount) {
    }

    /** The stubs that would be (or were) generated from the spec, plus where the spec was read from. */
    public record MappingsPreview(String openApiPath, List<Stub> stubs) {
    }

    @GetMapping("/mappings")
    public MappingsPreview mappings() {
        return new MappingsPreview(resolveOpenApi().toAbsolutePath().toString(), generateStubs());
    }

    @GetMapping("/status")
    public WiremockStatus status() {
        return currentStatus();
    }

    @PostMapping("/start")
    public synchronized WiremockStatus start() {
        if (isRunning()) {
            return currentStatus();
        }
        List<Stub> stubs = generateStubs();
        try {
            workDir = Files.createTempDirectory("petclinic-wiremock");
            Path mappingsDir = Files.createDirectories(workDir.resolve("mappings"));
            for (Stub stub : stubs) {
                Files.writeString(mappingsDir.resolve(stub.name() + ".json"), stub.json());
            }
            port = findFreePort();
            List<String> argv = List.of(
                Path.of(System.getProperty("java.home"), "bin", "java").toString(),
                "-jar", resolveWiremockJar().toString(),
                "--port", Integer.toString(port),
                "--root-dir", workDir.toString(),
                "--enable-stub-cors",
                "--verbose");
            command = String.join(" ", argv);
            log.info("Starting WireMock: {}", command);
            process = new ProcessBuilder(argv)
                .redirectErrorStream(true)
                .redirectOutput(workDir.resolve("wiremock.log").toFile())
                .start();
            awaitReady();
            log.info("WireMock up on {} with {} stub(s)", baseUrl(), stubs.size());
            return currentStatus();
        } catch (IOException e) {
            stopQuietly();
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                "Failed to start WireMock: " + e.getMessage(), e);
        }
    }

    @PostMapping("/stop")
    public synchronized WiremockStatus stop() {
        stopQuietly();
        return currentStatus();
    }

    private List<Stub> generateStubs() {
        Path spec = resolveOpenApi();
        try {
            List<Stub> stubs = WiremockStubGenerator.generateFromFile(spec);
            if (stubs.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "No response examples found in " + spec.toAbsolutePath()
                        + " — add @ExampleObject examples and regenerate openapi.yaml.");
            }
            return stubs;
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                "Cannot read OpenAPI spec at " + spec.toAbsolutePath() + ": " + e.getMessage(), e);
        }
    }

    private Path resolveOpenApi() {
        for (String candidate : new String[] {openApiPath, "../openapi.yaml", "openapi.yaml"}) {
            if (candidate != null && !candidate.isBlank() && Files.isRegularFile(Path.of(candidate))) {
                return Path.of(candidate);
            }
        }
        throw new ResponseStatusException(HttpStatus.NOT_FOUND,
            "openapi.yaml not found (looked at '" + openApiPath + "'). Run OpenApiExtractorTest to generate it.");
    }

    /** Finds the WireMock standalone jar: config override, then target/wiremock, then the local Maven repo. */
    private Path resolveWiremockJar() {
        if (configuredJar != null && !configuredJar.isBlank() && Files.isRegularFile(Path.of(configuredJar))) {
            return Path.of(configuredJar);
        }
        Path copiedDir = Path.of("target", "wiremock");
        if (Files.isDirectory(copiedDir)) {
            try (Stream<Path> jars = Files.list(copiedDir)) {
                Path match = jars
                    .filter(p -> p.getFileName().toString().matches("wiremock-standalone-.*\\.jar"))
                    .findFirst().orElse(null);
                if (match != null) {
                    return match;
                }
            } catch (IOException ignored) {
                // fall through to the Maven-repo lookup
            }
        }
        Path m2 = Path.of(System.getProperty("user.home"), ".m2", "repository", "org", "wiremock",
            "wiremock-standalone", WIREMOCK_VERSION, "wiremock-standalone-" + WIREMOCK_VERSION + ".jar");
        if (Files.isRegularFile(m2)) {
            return m2;
        }
        throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
            "wiremock-standalone jar not found. Run `mvn install` (copies it to target/wiremock) "
                + "or set petclinic.devtools.wiremock.jar.");
    }

    private void awaitReady() {
        URI health = URI.create(baseUrl() + "/__admin/health");
        HttpRequest request = HttpRequest.newBuilder(health).timeout(Duration.ofSeconds(1)).GET().build();
        for (int attempt = 0; attempt < 50; attempt++) {
            if (!process.isAlive()) {
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "WireMock process exited during startup — see " + workDir.resolve("wiremock.log"));
            }
            try {
                HttpResponse<Void> response = HTTP.send(request, HttpResponse.BodyHandlers.discarding());
                if (response.statusCode() < 500) {
                    return;
                }
            } catch (IOException retry) {
                sleep();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
        throw new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT,
            "WireMock did not become ready on port " + port);
    }

    private void stopQuietly() {
        if (process != null) {
            process.destroy();
            process = null;
        }
        port = 0;
        command = null;
    }

    private boolean isRunning() {
        return process != null && process.isAlive();
    }

    private WiremockStatus currentStatus() {
        boolean running = isRunning();
        return new WiremockStatus(running, running ? port : null, running ? baseUrl() : null, command,
            running ? safeStubCount() : 0);
    }

    private int safeStubCount() {
        try {
            return WiremockStubGenerator.generateFromFile(resolveOpenApi()).size();
        } catch (Exception e) {
            return 0;
        }
    }

    private String baseUrl() {
        return "http://localhost:" + port;
    }

    private static int findFreePort() throws IOException {
        try (ServerSocket socket = new ServerSocket(0)) {
            return socket.getLocalPort();
        }
    }

    private static void sleep() {
        try {
            Thread.sleep(200);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
