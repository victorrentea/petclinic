package victor.training.petclinic.chatbot.firefighter;

/**
 * What Grafana told us about unhealthy services. When {@code available} is false the observability
 * stack couldn't be queried (degraded gracefully) and {@code reason} explains why; the metric/log
 * findings are then "unavailable".
 */
public record GrafanaFindings(boolean available, String reason, String metricFinding, String logFinding) {

  static GrafanaFindings unavailable(String reason) {
    return new GrafanaFindings(false, reason, "unavailable", "unavailable");
  }

  static GrafanaFindings available(String metricFinding, String logFinding) {
    return new GrafanaFindings(true, "ok", metricFinding, logFinding);
  }
}
