package victor.training.petclinic.chatbot.firefighter;

import java.util.Base64;
import java.util.List;
import java.util.Map;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Queries Grafana for evidence about unhealthy services. In this setup ONLY Grafana is exposed on a
 * host port (:3300, admin/admin) plus OTLP ingest (:4318) — Prometheus and Loki are NOT reachable
 * directly. So we go through Grafana's datasource proxy / unified query API:
 * <ul>
 *   <li><b>Metrics (PromQL):</b> POST {@code /api/ds/query} with a Prometheus target — e.g.
 *       {@code up == 0} to find services Prometheus reports down.</li>
 *   <li><b>Logs (LogQL):</b> POST {@code /api/ds/query} with a Loki target — e.g.
 *       {@code {level="error"}} to surface recent error logs.</li>
 * </ul>
 *
 * <p>If Grafana is unreachable (the common workshop case — observability not started) the client
 * degrades gracefully: it returns a {@link GrafanaFindings} marked {@code available=false} with the
 * reason, and NEVER throws into the agent flow.
 */
@Slf4j
@Component
public class GrafanaClient {

  private final RestClient http;

  public GrafanaClient(
      @Value("${firefighter.grafana.url:http://localhost:3300}") String baseUrl,
      @Value("${firefighter.grafana.user:admin}") String user,
      @Value("${firefighter.grafana.password:admin}") String password) {
    String basic = Base64.getEncoder()
        .encodeToString((user + ":" + password).getBytes());
    this.http = RestClient.builder()
        .baseUrl(baseUrl)
        .defaultHeader(HttpHeaders.AUTHORIZATION, "Basic " + basic)
        .build();
  }

  /**
   * Probe Grafana for unhealthy-service evidence via the datasource query proxy. Returns findings
   * marked unavailable (never throws) when Grafana or its datasources can't be reached.
   */
  public GrafanaFindings findUnhealthy() {
    if (!isReachable()) {
      return GrafanaFindings.unavailable("Grafana not reachable (observability stack likely not running)");
    }
    String metricFinding = queryPrometheus("up == 0");
    String logFinding = queryLoki("{level=\"error\"} | json");
    return GrafanaFindings.available(metricFinding, logFinding);
  }

  private boolean isReachable() {
    try {
      http.get().uri("/api/health").retrieve().toBodilessEntity();
      return true;
    } catch (RuntimeException e) {
      log.debug("Grafana /api/health unreachable: {}", e.toString());
      return false;
    }
  }

  /** PromQL via the unified query API; "unavailable" on any error (e.g. Prometheus datasource absent). */
  private String queryPrometheus(String promql) {
    try {
      Map<String, Object> body = Map.of("queries", List.of(Map.of(
          "refId", "A",
          "datasource", Map.of("type", "prometheus", "uid", "prometheus"),
          "expr", promql,
          "instant", true)));
      Object response = http.post().uri("/api/ds/query").body(body).retrieve().body(Object.class);
      return summarize("PromQL[" + promql + "]", response);
    } catch (RuntimeException e) {
      log.debug("PromQL query failed: {}", e.toString());
      return "unavailable";
    }
  }

  /** LogQL via the unified query API; "unavailable" on any error (e.g. Loki datasource absent). */
  private String queryLoki(String logql) {
    try {
      Map<String, Object> body = Map.of("queries", List.of(Map.of(
          "refId", "A",
          "datasource", Map.of("type", "loki", "uid", "loki"),
          "expr", logql)));
      Object response = http.post().uri("/api/ds/query").body(body).retrieve().body(Object.class);
      return summarize("LogQL[" + logql + "]", response);
    } catch (RuntimeException e) {
      log.debug("LogQL query failed: {}", e.toString());
      return "unavailable";
    }
  }

  private String summarize(String label, Object response) {
    if (response == null) {
      return label + ": (empty)";
    }
    String text = response.toString();
    int max = 400;
    return label + ": " + (text.length() > max ? text.substring(0, max) + "…" : text);
  }
}
