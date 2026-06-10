package victor.training.petclinic.chatbot;

import com.embabel.agent.test.unit.FakeOperationContext;
import org.junit.jupiter.api.Test;

import victor.training.petclinic.chatbot.PetTriageAgent.OwnerSymptom;
import victor.training.petclinic.chatbot.PetTriageAgent.SpecialtyRecommendation;
import victor.training.petclinic.chatbot.PetTriageAgent.TriageReport;
import victor.training.petclinic.chatbot.PetTriageAgent.UrgencyAssessment;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit-tests the Embabel triage agent's actions in isolation with a {@link FakeOperationContext} —
 * NO real LLM call, so it stays in the seconds-level/CI-safe band (the OpenAI e2e is exercised
 * manually, like the chatbot's). Each action is just a plain method taking an OperationContext, so
 * we can drive it directly and assert on the prompt the planner would feed the model.
 */
class PetTriageAgentTest {

  private final PetTriageAgent agent = new PetTriageAgent();

  @Test
  void assessUrgency_passes_the_symptom_to_the_model() {
    FakeOperationContext ctx = FakeOperationContext.create();
    ctx.expectResponse(new UrgencyAssessment(true, "possible fracture"));

    UrgencyAssessment result = agent.assessUrgency(
        new OwnerSymptom("my dog Leo is limping after a fall"), ctx);

    assertThat(result.emergency()).isTrue();
    assertThat(ctx.getLlmInvocations().get(0).getPrompt()).contains("Leo");
  }

  @Test
  void report_fuses_both_upstream_assessments_into_the_prompt() {
    FakeOperationContext ctx = FakeOperationContext.create();
    ctx.expectResponse(new TriageReport("**Radiology** recommended. Keep Leo calm and rested."));

    TriageReport report = agent.report(
        new UrgencyAssessment(true, "possible fracture"),
        new SpecialtyRecommendation("radiology", "restrict movement"),
        ctx);

    assertThat(report.markdown()).contains("Radiology");
    // The whole point of the multi-step flow: the goal action sees BOTH blackboard objects the
    // planner produced (urgency + specialty), so both must reach the final prompt.
    String prompt = ctx.getLlmInvocations().get(0).getPrompt();
    assertThat(prompt).contains("radiology");
    assertThat(prompt).contains("possible fracture");
  }
}
