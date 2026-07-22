package victor.training.petclinic.chatbot.firefighter;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.context.annotation.Scope;
import org.springframework.stereotype.Component;

/**
 * The stateful HARD guardrail — a Spring component, NOT a prompt instruction — that every restart
 * goes through, so the rules hold regardless of what the LLM/planner picks:
 *
 * <ol>
 *   <li><b>Order:</b> restart ONLY in DB → BE → FE → OTEL order. A service is allowed only if it is
 *       at or before the "frontier+1" — i.e. you cannot jump ahead past a service that hasn't been
 *       restarted yet (its predecessor still needs attention). Re-restarting an already-touched
 *       service stays in order.</li>
 *   <li><b>Per-service cap:</b> at most 2 restarts of the same service.</li>
 *   <li><b>Total cap → escalation:</b> the 3rd restart across ALL services still runs, but flips the
 *       guard to {@code escalated}; from then on every further restart is refused and the agent must
 *       emit the escalation summary.</li>
 * </ol>
 *
 * <p>State is per-instance and request-scoped via the agent flow (a fresh guard per incident — see
 * the {@code @Scope("prototype")} bean). The actual OS kill+relaunch is delegated to the injected
 * {@link ProcessControl}, which tests stub.
 */
@Slf4j
@Component
@Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE) // fresh recovery state per incident
public class FirefighterGuard {

  private static final int MAX_PER_SERVICE = 2;
  private static final int MAX_TOTAL = 3;

  private final ProcessControl process;

  /** How many times each service has been (successfully) restarted. */
  private final Map<Service, Integer> restartCounts = new EnumMap<>(Service.class);
  /** Ordered log of every accepted action, for the escalation summary. */
  private final List<String> actionLog = new ArrayList<>();
  /** Highest-ordinal service restarted so far (the "frontier"); -1 means none yet. */
  private int frontier = -1;
  private boolean escalated;

  public FirefighterGuard(ProcessControl process) {
    this.process = process;
  }

  /**
   * Attempt to restart {@code service}, enforcing order + limits. Accepted restarts kill the port
   * then relaunch the script (in that order). Refused requests are no-ops with a reason.
   */
  public RestartResult restart(Service service) {
    if (escalated) {
      String reason = service + " restart refused: already escalated (total restart cap of "
          + MAX_TOTAL + " reached) — handing off to a human.";
      log.warn("🚒 {}", reason);
      return RestartResult.refused(service, reason);
    }
    if (service.ordinal() > frontier + 1) {
      String reason = service + " restart refused: out of order — a predecessor still needs "
          + "attention. Recovery order is DB → BE → FE → OTEL.";
      log.warn("🚒 {}", reason);
      return RestartResult.refused(service, reason);
    }
    int already = restartCounts.getOrDefault(service, 0);
    if (already >= MAX_PER_SERVICE) {
      String reason = service + " restart refused: reached the max of " + MAX_PER_SERVICE
          + " restarts for this service.";
      log.warn("🚒 {}", reason);
      return RestartResult.refused(service, reason);
    }

    // Accepted — perform the REAL kill + relaunch via the (stubbed-in-test) ProcessControl.
    process.kill(service.port());
    process.start(service.script());
    restartCounts.merge(service, 1, Integer::sum);
    frontier = Math.max(frontier, service.ordinal());

    int total = totalRestarts();
    String note = "Restarted " + service + " (kill -9 :" + service.port() + " then "
        + service.script() + ") — attempt " + restartCounts.get(service) + "/" + MAX_PER_SERVICE
        + ", " + total + "/" + MAX_TOTAL + " total.";
    actionLog.add(note);
    log.info("🚒 {}", note);

    boolean tripped = false;
    if (total >= MAX_TOTAL) {
      escalated = true;
      tripped = true;
      log.warn("🚒 Total restart cap of {} reached — escalating, no further restarts.", MAX_TOTAL);
    }
    return RestartResult.accepted(service, note, tripped);
  }

  /** True once the 3-total cap has tripped; no further restarts will be accepted. */
  public boolean isEscalated() {
    return escalated;
  }

  public int totalRestarts() {
    return restartCounts.values().stream().mapToInt(Integer::intValue).sum();
  }

  public int restartsOf(Service service) {
    return restartCounts.getOrDefault(service, 0);
  }

  /** Immutable copy of the accepted-action log (for reports/tests). */
  public List<String> actions() {
    return List.copyOf(actionLog);
  }

  /**
   * A human-escalation summary describing every action taken so far, reacting to {@code incident}.
   * Listing the actions explicitly (not via the LLM) keeps the audit trail deterministic.
   */
  public String escalationSummary(String incident) {
    StringBuilder sb = new StringBuilder();
    sb.append("ESCALATION — human attention required.\n");
    sb.append("Incident: ").append(incident == null ? "(unspecified)" : incident).append('\n');
    sb.append("Total restarts: ").append(totalRestarts()).append('/').append(MAX_TOTAL);
    sb.append(escalated ? " (cap reached)\n" : "\n");
    sb.append("Actions taken (in order):\n");
    if (actionLog.isEmpty()) {
      sb.append("  - none\n");
    } else {
      for (int i = 0; i < actionLog.size(); i++) {
        sb.append("  ").append(i + 1).append(". ").append(actionLog.get(i)).append('\n');
      }
    }
    return sb.toString();
  }
}
