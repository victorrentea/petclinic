package victor.training.petclinic.chatbot.firefighter;

import java.util.Optional;

/**
 * The four managed PetClinic services, in their MANDATORY recovery order
 * (DB → BE → FE → OTEL). Declaration order IS the recovery order: {@link #ordinal()}
 * is used by {@link FirefighterGuard} to refuse out-of-order restarts.
 *
 * <p>Each carries the TCP {@code port} it listens on, the {@code script} (at the repo root,
 * one level above this module) that (re)launches it, and — for services that expose Spring
 * Boot Actuator — the {@code healthPath}. The scripts are run detached by {@code ProcessControl};
 * the port is what we {@code kill -9} before relaunching.
 */
public enum Service {
  DB("./start-database.sh", 5432, null),
  BE("./start-backend.sh", 8080, "/actuator/health"),
  FE("./start-frontend.sh", 4200, null),
  OTEL("./start-grafana.sh", 3300, null);

  private final String script;
  private final int port;
  private final String healthPath;

  Service(String script, int port, String healthPath) {
    this.script = script;
    this.port = port;
    this.healthPath = healthPath;
  }

  public String script() {
    return script;
  }

  public int port() {
    return port;
  }

  /** The Actuator health path if this service exposes one (BE), else empty. */
  public Optional<String> healthPath() {
    return Optional.ofNullable(healthPath);
  }

  /** Base URL for a localhost HTTP probe against this service (e.g. {@code http://localhost:8080}). */
  public String baseUrl() {
    return "http://localhost:" + port;
  }
}
