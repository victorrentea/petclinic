package victor.training.petclinic.chatbot.firefighter;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.time.Duration;
import java.util.Map;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Read-only health/metrics probes against the managed services. Two strategies:
 * <ul>
 *   <li><b>Actuator</b> for services that expose it (BE): GET {@code /actuator/health} and read the
 *       {@code status} field; GET {@code /actuator/metrics/{name}} for a couple of key metrics.</li>
 *   <li><b>TCP</b> for the rest (DB, FE, OTEL): a plain socket connect to the port.</li>
 * </ul>
 *
 * <p>Everything degrades gracefully — an unreachable service yields {@code DOWN}/"unavailable"
 * rather than throwing, so the agent can still plan a recovery. This component performs NO mutation
 * (never kills/launches), so it is safe to exercise; tests inject a stubbed instance to stay offline.
 */
@Slf4j
@Component
public class HealthProbe {

  private final RestClient http = RestClient.builder().build();
  private final Duration timeout = Duration.ofMillis(800);

  /** Liveness of a single service: Actuator {@code status} when available, else a TCP check. */
  public ServiceHealth check(Service service) {
    if (service.healthPath().isPresent()) {
      return checkActuator(service);
    }
    return checkTcp(service);
  }

  private ServiceHealth checkActuator(Service service) {
    String url = service.baseUrl() + service.healthPath().orElseThrow();
    try {
      @SuppressWarnings("unchecked")
      Map<String, Object> body = http.get().uri(url).retrieve().body(Map.class);
      String status = body == null ? "UNKNOWN" : String.valueOf(body.get("status"));
      boolean up = "UP".equalsIgnoreCase(status);
      return new ServiceHealth(service, up, "actuator:" + status);
    } catch (RuntimeException e) {
      log.debug("actuator probe failed for {}: {}", service, e.toString());
      return new ServiceHealth(service, false, "actuator:unreachable");
    }
  }

  private ServiceHealth checkTcp(Service service) {
    try (Socket socket = new Socket()) {
      socket.connect(new InetSocketAddress("localhost", service.port()), (int) timeout.toMillis());
      return new ServiceHealth(service, true, "tcp:open");
    } catch (IOException e) {
      return new ServiceHealth(service, false, "tcp:closed");
    }
  }

  /**
   * A few key BE Actuator metrics (JVM memory + HTTP request count). Returns "unavailable" values
   * on any error rather than failing the flow.
   */
  public MetricsSnapshot readMetrics() {
    String used = readMetric(Service.BE, "jvm.memory.used");
    String requests = readMetric(Service.BE, "http.server.requests");
    return new MetricsSnapshot(Map.of(
        "jvm.memory.used", used,
        "http.server.requests", requests));
  }

  private String readMetric(Service service, String name) {
    String url = service.baseUrl() + "/actuator/metrics/" + name;
    try {
      @SuppressWarnings("unchecked")
      Map<String, Object> body = http.get().uri(url).retrieve().body(Map.class);
      if (body == null) {
        return "unavailable";
      }
      Object measurements = body.get("measurements");
      return measurements == null ? "unavailable" : String.valueOf(measurements);
    } catch (RuntimeException e) {
      log.debug("metric {} unavailable: {}", name, e.toString());
      return "unavailable";
    }
  }
}
