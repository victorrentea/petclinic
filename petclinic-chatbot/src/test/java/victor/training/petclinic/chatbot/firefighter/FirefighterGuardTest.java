package victor.training.petclinic.chatbot.firefighter;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static victor.training.petclinic.chatbot.firefighter.Service.BE;
import static victor.training.petclinic.chatbot.firefighter.Service.DB;
import static victor.training.petclinic.chatbot.firefighter.Service.FE;
import static victor.training.petclinic.chatbot.firefighter.Service.OTEL;

/**
 * The HARD guardrails, unit-tested with {@link ProcessControl} STUBBED — no real process is ever
 * killed or launched. These rules are enforced in Java (here), NOT in the LLM prompt, so they hold
 * regardless of what the planner/model picks:
 * <ul>
 *   <li>restarts happen ONLY in DB → BE → FE → OTEL order; an out-of-order request is refused;</li>
 *   <li>at most 2 restarts per service;</li>
 *   <li>the 3rd total restart across all services flips the guard to "escalated" — no further
 *       restarts, and the escalation summary lists every action taken.</li>
 * </ul>
 */
class FirefighterGuardTest {

  /** Records calls instead of touching the OS. */
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

  private RecordingProcessControl process;
  private FirefighterGuard guard;

  @BeforeEach
  void setUp() {
    process = new RecordingProcessControl();
    guard = new FirefighterGuard(process);
  }

  @Test
  void restart_kills_the_port_then_launches_the_script() {
    RestartResult result = guard.restart(DB);

    assertThat(result.accepted()).isTrue();
    // The real recovery is: kill -9 the PID on the port, THEN relaunch the script (in that order).
    assertThat(process.calls).containsExactly("kill:5432", "start:./start-database.sh");
  }

  @Test
  void restarts_must_follow_DB_BE_FE_OTEL_order() {
    // Restarting BE before DB has been restarted is out of order -> refused, no OS calls.
    RestartResult result = guard.restart(BE);

    assertThat(result.accepted()).isFalse();
    assertThat(result.reason()).containsIgnoringCase("order");
    assertThat(process.calls).isEmpty();
  }

  @Test
  void in_order_restarts_are_all_accepted() {
    assertThat(guard.restart(DB).accepted()).isTrue();
    assertThat(guard.restart(BE).accepted()).isTrue();
    assertThat(guard.restart(FE).accepted()).isTrue();
    // OTEL is the 4th distinct service -> but only the 1st,2nd,3rd total restarts run; see cap test.
  }

  @Test
  void a_service_may_be_restarted_at_most_twice() {
    guard.restart(DB);               // 1st DB
    RestartResult second = guard.restart(DB); // 2nd DB — still allowed
    assertThat(second.accepted()).isTrue();

    // A 3rd attempt on DB would also be the 3rd TOTAL restart; isolate the per-service cap by
    // checking the reason mentions the per-service limit, and that no kill happened for it.
    int callsBefore = process.calls.size();
    RestartResult third = guard.restart(DB);
    assertThat(third.accepted()).isFalse();
    assertThat(third.reason()).containsIgnoringCase("max");
    assertThat(process.calls).hasSize(callsBefore); // no extra kill/start
  }

  @Test
  void the_third_total_restart_forces_escalation_and_blocks_further_restarts() {
    assertThat(guard.isEscalated()).isFalse();

    guard.restart(DB); // total 1
    guard.restart(BE); // total 2
    RestartResult third = guard.restart(FE); // total 3 -> still runs, but trips escalation

    assertThat(third.accepted()).isTrue();
    assertThat(guard.isEscalated()).isTrue();

    // A 4th restart (even a valid next-in-order OTEL) is now refused.
    int callsBefore = process.calls.size();
    RestartResult fourth = guard.restart(OTEL);
    assertThat(fourth.accepted()).isFalse();
    assertThat(fourth.reason()).containsIgnoringCase("escalat");
    assertThat(process.calls).hasSize(callsBefore);
  }

  @Test
  void escalation_summary_lists_every_action_taken_in_order() {
    guard.restart(DB);
    guard.restart(BE);
    guard.restart(FE); // trips escalation

    String summary = guard.escalationSummary("backend returning 500s");

    assertThat(summary).contains("DB").contains("BE").contains("FE");
    assertThat(summary).containsIgnoringCase("escalat");
    // Mentions the incident it was reacting to.
    assertThat(summary).contains("backend returning 500s");
  }

  @Test
  void refused_out_of_order_restart_does_not_count_toward_any_limit() {
    guard.restart(BE); // refused (order) — must not consume a restart slot
    guard.restart(DB); // total 1
    guard.restart(BE); // total 2 — now in order, accepted

    assertThat(guard.totalRestarts()).isEqualTo(2);
    assertThat(guard.isEscalated()).isFalse();
  }
}
