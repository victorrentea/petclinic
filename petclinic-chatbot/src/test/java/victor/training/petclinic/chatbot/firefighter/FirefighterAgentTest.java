package victor.training.petclinic.chatbot.firefighter;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import com.embabel.agent.test.unit.FakeOperationContext;
import org.junit.jupiter.api.Test;

import victor.training.petclinic.chatbot.firefighter.FirefighterAgent.HealthSnapshot;
import victor.training.petclinic.chatbot.firefighter.FirefighterAgent.Incident;
import victor.training.petclinic.chatbot.firefighter.FirefighterAgent.IncidentReport;
import victor.training.petclinic.chatbot.firefighter.FirefighterAgent.RecoveryOutcome;

import static org.assertj.core.api.Assertions.assertThat;
import static victor.training.petclinic.chatbot.firefighter.Service.BE;
import static victor.training.petclinic.chatbot.firefighter.Service.DB;
import static victor.training.petclinic.chatbot.firefighter.Service.FE;
import static victor.training.petclinic.chatbot.firefighter.Service.OTEL;

/**
 * Drives the Embabel firefighter agent's {@code @Action} methods directly — NO real LLM, NO real
 * process. The recovery action's restart decisions go through the SAME {@link FirefighterGuard}
 * (with {@link ProcessControl} stubbed), so the order/limit/escalation guarantees are exercised
 * end-to-end through the agent, not just the guard in isolation.
 */
class FirefighterAgentTest {

  static class RecordingProcessControl implements ProcessControl {
    final List<String> calls = new ArrayList<>();

    @Override
    public boolean kill(int port) {
      calls.add("kill:" + port);
      return true;
    }

    @Override
    public void start(String script) {
      calls.add("start:" + script);
    }
  }

  private final RecordingProcessControl process = new RecordingProcessControl();
  private final FirefighterGuard guard = new FirefighterGuard(process);
  // The agent takes a guard supplier so each run gets a fresh one; here we hand it our test guard.
  private final FirefighterAgent agent = new FirefighterAgent("gpt-4o-mini", () -> guard);

  private HealthSnapshot snapshotWithDown(Service... down) {
    List<ServiceHealth> healths = new ArrayList<>();
    List<Service> downList = List.of(down);
    for (Service s : Service.values()) {
      healths.add(new ServiceHealth(s, !downList.contains(s), "test"));
    }
    return new HealthSnapshot(healths);
  }

  @Test
  void recover_restarts_only_down_services_in_DB_BE_FE_OTEL_order() {
    // BE and DB are down (deliberately given out of natural order) — guard must restart DB then BE.
    RecoveryOutcome outcome = agent.recover(
        new Incident("backend 500s"), snapshotWithDown(BE, DB),
        new MetricsSnapshot(Map.of()), GrafanaFindings.unavailable("offline"));

    assertThat(process.calls).containsExactly(
        "kill:" + DB.port(), "start:" + DB.script(),
        "kill:" + BE.port(), "start:" + BE.script());
    assertThat(outcome.restartedServices()).containsExactly(DB, BE);
    assertThat(outcome.escalated()).isFalse();
  }

  @Test
  void recover_escalates_after_three_total_restarts_and_stops() {
    // All four down: only the first three (DB, BE, FE) restart, then the cap trips -> escalate,
    // OTEL is NOT restarted.
    RecoveryOutcome outcome = agent.recover(
        new Incident("everything is on fire"), snapshotWithDown(DB, BE, FE, OTEL),
        new MetricsSnapshot(Map.of()), GrafanaFindings.unavailable("offline"));

    assertThat(outcome.restartedServices()).containsExactly(DB, BE, FE);
    assertThat(process.calls).doesNotContain("kill:" + OTEL.port());
    assertThat(outcome.escalated()).isTrue();
    assertThat(outcome.escalationSummary()).contains("DB").contains("BE").contains("FE")
        .containsIgnoringCase("escalat");
  }

  @Test
  void recover_when_all_healthy_restarts_nothing_and_does_not_escalate() {
    RecoveryOutcome outcome = agent.recover(
        new Incident("false alarm"), snapshotWithDown(),
        new MetricsSnapshot(Map.of()), GrafanaFindings.unavailable("offline"));

    assertThat(process.calls).isEmpty();
    assertThat(outcome.restartedServices()).isEmpty();
    assertThat(outcome.escalated()).isFalse();
  }

  @Test
  void report_includes_the_escalation_summary_in_the_prompt_when_escalated() {
    FakeOperationContext ctx = FakeOperationContext.create();
    ctx.expectResponse(new IncidentReport("# Incident\nEscalated to a human."));

    RecoveryOutcome escalated = agent.recover(
        new Incident("everything is on fire"), snapshotWithDown(DB, BE, FE, OTEL),
        new MetricsSnapshot(Map.of()), GrafanaFindings.unavailable("offline"));

    IncidentReport report = agent.report(
        new Incident("everything is on fire"),
        snapshotWithDown(DB, BE, FE, OTEL),
        new MetricsSnapshot(Map.of("jvm.memory.used", "123")),
        GrafanaFindings.unavailable("offline"),
        escalated, ctx);

    assertThat(report.markdown()).contains("Escalated");
    String prompt = ctx.getLlmInvocations().get(0).getPrompt();
    // The deterministic escalation summary (every action taken) must reach the report prompt.
    assertThat(prompt).containsIgnoringCase("escalat");
    assertThat(prompt).contains("Restarted DB");
  }
}
