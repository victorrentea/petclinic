package victor.training.petclinic.chatbot.firefighter;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Supplier;

import com.embabel.agent.api.annotation.AchievesGoal;
import com.embabel.agent.api.annotation.Action;
import com.embabel.agent.api.annotation.Agent;
import com.embabel.agent.api.common.OperationContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * An Embabel GOAP "firefighter" SRE agent (a sibling of {@code PetTriageAgent}). Each capability is an
 * {@link Action}; the planner chains them by Java type to reach the goal {@link IncidentReport}:
 *
 * <pre>
 *   Incident ─assessHealth─▶ HealthSnapshot ─readMetrics─▶ MetricsSnapshot ┐
 *                                 │                                        ├─▶ recover
 *                                 └──────────queryGrafana──▶ GrafanaFindings┘    │
 *                                                              RecoveryOutcome ─▶ report ─▶ IncidentReport
 * </pre>
 *
 * <p>{@code assessHealth}, {@code readMetrics} and {@code queryGrafana} are READ-ONLY (probes only —
 * Actuator/TCP/Grafana, all degrading gracefully). The only mutating capability, {@code recover},
 * routes EVERY restart through {@link FirefighterGuard}, so the HARD guardrails (DB→BE→FE→OTEL order,
 * max 2/service, escalate after 3 total) hold no matter what the planner chooses. The actual
 * kill+relaunch is behind {@link ProcessControl} — {@link RealProcessControl} in prod, stubbed in tests.
 *
 * <p>A FRESH {@link FirefighterGuard} is taken per run (prototype-scoped), so recovery state never
 * leaks across incidents.
 */
@Slf4j
@Agent(description = "SRE firefighter: assess PetClinic service health, consult metrics/Grafana, "
    + "and recover (guarded restarts in DB→BE→FE→OTEL order) or escalate")
@Component
public class FirefighterAgent {

  private final String model;
  private final Supplier<FirefighterGuard> guardSupplier;

  /** All managed services to probe, in recovery order. */
  public record Incident(String description) {}

  public record HealthSnapshot(List<ServiceHealth> services) {
    public List<Service> downServices() {
      List<Service> down = new ArrayList<>();
      for (ServiceHealth h : services) {
        if (!h.up()) {
          down.add(h.service());
        }
      }
      return down;
    }
  }

  public record RecoveryOutcome(List<Service> restartedServices, List<String> refusals,
      boolean escalated, String escalationSummary) {}

  public record IncidentReport(String markdown) {}

  /** Spring wires the prototype-guard provider; the model comes from the SAME property as the others. */
  public FirefighterAgent(
      @Value("${spring.ai.openai.chat.options.model:gpt-4o-mini}") String model,
      ObjectProvider<FirefighterGuard> guardProvider) {
    this(model, guardProvider::getObject);
  }

  /** Test seam: inject a guard supplier directly (no Spring). */
  FirefighterAgent(String model, Supplier<FirefighterGuard> guardSupplier) {
    this.model = model;
    this.guardSupplier = guardSupplier;
  }

  // ── Capability 1: assess health (read-only) ────────────────────────────────────────────────────
  @Action
  public HealthSnapshot assessHealth(Incident incident, HealthProbe probe) {
    List<ServiceHealth> healths = new ArrayList<>();
    for (Service service : Service.values()) {
      healths.add(probe.check(service));
    }
    log.info("🚒 health snapshot for incident '{}': {}", incident.description(), healths);
    return new HealthSnapshot(healths);
  }

  // ── Capability 2: read metrics (read-only) ──────────────────────────────────────────────────────
  @Action
  public MetricsSnapshot readMetrics(HealthSnapshot health, HealthProbe probe) {
    return probe.readMetrics();
  }

  // ── Capability 3: query Grafana for unhealthy-service evidence (read-only, degrades gracefully) ──
  @Action
  public GrafanaFindings queryGrafana(HealthSnapshot health, GrafanaClient grafana) {
    return grafana.findUnhealthy();
  }

  // ── Capability 4: recover — the ONLY mutating capability, fully guarded ──────────────────────────
  @Action
  public RecoveryOutcome recover(Incident incident, HealthSnapshot health,
      MetricsSnapshot metrics, GrafanaFindings grafana) {
    FirefighterGuard guard = guardSupplier.get();
    List<Service> restarted = new ArrayList<>();
    List<String> refusals = new ArrayList<>();

    // Walk services in the canonical recovery order; restart only the down ones, via the guard.
    for (Service service : Service.values()) {
      if (guard.isEscalated()) {
        break; // cap hit — stop restarting, escalate instead
      }
      boolean down = health.services().stream()
          .anyMatch(h -> h.service() == service && !h.up());
      if (!down) {
        continue;
      }
      RestartResult result = guard.restart(service);
      if (result.accepted()) {
        restarted.add(service);
      } else {
        refusals.add(result.reason());
      }
    }

    boolean escalated = guard.isEscalated();
    String summary = guard.escalationSummary(incident.description());
    if (escalated) {
      escalate(summary); // Capability 5: write the human-escalation summary to the LOG
    }
    return new RecoveryOutcome(List.copyOf(restarted), List.copyOf(refusals), escalated, summary);
  }

  // ── Capability 5: escalate — write the human-escalation summary to the LOG ───────────────────────
  private void escalate(String summary) {
    log.warn("🚒🆘 ESCALATION — human attention required:\n{}", summary);
  }

  // ── Goal: the markdown incident report ──────────────────────────────────────────────────────────
  @AchievesGoal(description = "A markdown incident report of health, actions taken, and outcome")
  @Action
  public IncidentReport report(Incident incident, HealthSnapshot health, MetricsSnapshot metrics,
      GrafanaFindings grafana, RecoveryOutcome recovery, OperationContext context) {
    String downList = health.downServices().isEmpty() ? "none"
        : health.downServices().toString();
    String restartedList = recovery.restartedServices().isEmpty() ? "none"
        : recovery.restartedServices().toString();
    return context.ai().withLlm(model).createObject("""
        Write a concise Markdown SRE incident report for the PetClinic platform.
        Incident: %s
        Service health (down services): %s
        Key metrics: %s
        Grafana findings (available=%s): metrics=%s | logs=%s
        Restarted services (in order): %s
        Refused actions: %s
        Escalated to a human: %s

        Below is the EXACT, authoritative audit trail of actions taken — reproduce its facts
        faithfully; do not invent restarts that aren't listed:
        ---
        %s
        ---
        Structure: a one-line status header, a short "What happened" section, a "Actions taken"
        bullet list, and — if escalated — a bold "ESCALATED" line telling the on-call human to take over.
        """.formatted(
            incident.description(),
            downList,
            metrics.metrics(),
            grafana.available(), grafana.metricFinding(), grafana.logFinding(),
            restartedList,
            recovery.refusals().isEmpty() ? "none" : recovery.refusals().toString(),
            recovery.escalated(),
            recovery.escalationSummary()),
        IncidentReport.class);
  }
}
