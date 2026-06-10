package victor.training.petclinic.chatbot;

import com.embabel.agent.api.annotation.AchievesGoal;
import com.embabel.agent.api.annotation.Action;
import com.embabel.agent.api.annotation.Agent;
import com.embabel.agent.api.common.OperationContext;
import com.embabel.agent.api.models.OpenAiModels;

/**
 * Embabel demo flow — a contrast to the single {@code ChatClient} prompt in {@link Assistant}.
 *
 * <p>Instead of one prompt doing everything, this is a GOAP agent: three {@link Action}s linked
 * only by their Java types. The goal {@link TriageReport} needs an {@link UrgencyAssessment} AND a
 * {@link SpecialtyRecommendation}, both derivable from the {@link OwnerSymptom} — so Embabel's
 * planner runs those two assessments (independent of each other) and then the report. We never wrote
 * the orchestration; the planner derived it from the type signatures.
 *
 * <p>{@code @Agent} is meta-annotated with Spring's {@code @Component}, so component scanning picks
 * this up and registers it with the {@code AgentPlatform} (see {@code @EnableAgents} on
 * {@link ChatbotApp}). Records are the "blackboard" objects passed between actions.
 */
@Agent(description = "Triages a pet symptom: assess urgency and recommend a single vet specialty")
public class PetTriageAgent {

  // gpt-4o-mini: same cheap, predictable model the Spring AI ChatClient is pinned to.
  private static final String MODEL = OpenAiModels.GPT_4O_MINI;

  public record OwnerSymptom(String text) {}

  public record UrgencyAssessment(boolean emergency, String reason) {}

  public record SpecialtyRecommendation(String specialty, String careTip) {}

  public record TriageReport(String markdown) {}

  @Action
  public UrgencyAssessment assessUrgency(OwnerSymptom symptom, OperationContext context) {
    return context.ai().withLlm(MODEL).createObject("""
        A pet owner describes this symptom for their pet:
        "%s"
        Decide whether it needs EMERGENCY veterinary attention now, with a one-line reason.
        """.formatted(symptom.text()), UrgencyAssessment.class);
  }

  @Action
  public SpecialtyRecommendation recommendSpecialty(OwnerSymptom symptom, OperationContext context) {
    return context.ai().withLlm(MODEL).createObject("""
        A pet owner describes this symptom for their pet:
        "%s"
        Pick the SINGLE most relevant vet specialty — one of: radiology, surgery, dentistry —
        and give one short, practical care tip for the meantime.
        """.formatted(symptom.text()), SpecialtyRecommendation.class);
  }

  @AchievesGoal(description = "A short triage report the owner can act on")
  @Action
  public TriageReport report(
      UrgencyAssessment urgency, SpecialtyRecommendation recommendation, OperationContext context) {
    return context.ai().withLlm(MODEL).createObject("""
        Write a short Markdown triage report for a pet owner. Be concise and reassuring.
        - Urgency: %s (%s)
        - Recommended specialty: %s
        - Care tip: %s
        Start with an urgency line, then the recommended specialty in **bold**, then the care tip.
        """.formatted(
            urgency.emergency() ? "EMERGENCY" : "not an emergency",
            urgency.reason(),
            recommendation.specialty(),
            recommendation.careTip()),
        TriageReport.class);
  }
}
