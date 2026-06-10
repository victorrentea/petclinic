package victor.training.petclinic.chatbot.triage;

import com.embabel.agent.api.annotation.AchievesGoal;
import com.embabel.agent.api.annotation.Action;
import com.embabel.agent.api.annotation.Agent;
import com.embabel.agent.api.common.OperationContext;
import com.embabel.agent.api.models.OpenAiModels;

/**
 * Embabel demo flow — a contrast to the single {@code ChatClient} prompt in {@code Assistant}.
 *
 * <p>Instead of one prompt doing everything, this is a GOAP agent: four {@link Action}s linked
 * only by their Java types. The goal {@link TriageReport} needs an {@link UrgencyAssessment}, a
 * {@link SpecialtyRecommendation} AND a {@link CostEstimate}: the first two are derivable from the
 * {@link OwnerSymptom}, and the {@link CostEstimate} is then computed from them by a pure, non-LLM
 * formula ({@link #estimateCost}). So Embabel's planner runs the two assessments (independent of
 * each other), then the cost formula, then the report. We never wrote the orchestration; the planner
 * derived it from the type signatures.
 *
 * <p>{@code @Agent} is meta-annotated with Spring's {@code @Component}, so component scanning picks
 * this up and registers it with the {@code AgentPlatform} (see {@code @EnableAgents} on
 * {@code ChatbotApp}). Records are the "blackboard" objects passed between actions.
 */
@Agent(description = "Triages a pet symptom: assess urgency and recommend a single vet specialty")
public class PetTriageAgent {

  // gpt-4o-mini: same cheap, predictable model the Spring AI ChatClient is pinned to.
  private static final String MODEL = OpenAiModels.GPT_4O_MINI;

  public record OwnerSymptom(String text) {}

  public record UrgencyAssessment(boolean emergency, String reason) {}

  public record SpecialtyRecommendation(String specialty, String careTip) {}

  public record CostEstimate(int estimatedCostUsd, String basis) {}

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

  @Action
  public CostEstimate estimateCost(SpecialtyRecommendation recommendation, UrgencyAssessment urgency) {
    // Simple flat-rate estimate — no LLM: a base consult fee per specialty, +50% for an emergency.
    int base = switch (recommendation.specialty().toLowerCase()) {
      case "surgery" -> 400;
      case "radiology" -> 250;
      case "dentistry" -> 180;
      default -> 120;
    };
    int total = urgency.emergency() ? base + base / 2 : base;
    String basis = recommendation.specialty() + " base $" + base;
    if (urgency.emergency()) {
      basis += " + 50% emergency surcharge";
    }
    return new CostEstimate(total, basis);
  }

  @AchievesGoal(description = "A short triage report the owner can act on")
  @Action
  public TriageReport report(UrgencyAssessment urgency, SpecialtyRecommendation recommendation,
      CostEstimate cost, OperationContext context) {
    return context.ai().withLlm(MODEL).createObject("""
        Write a short Markdown triage report for a pet owner. Be concise and reassuring.
        - Urgency: %s (%s)
        - Recommended specialty: %s
        - Care tip: %s
        - Estimated cost: $%d (%s)
        Start with an urgency line, then the recommended specialty in **bold**, then the care tip,
        and finally the estimated cost.
        """.formatted(
            urgency.emergency() ? "EMERGENCY" : "not an emergency",
            urgency.reason(),
            recommendation.specialty(),
            recommendation.careTip(),
            cost.estimatedCostUsd(),
            cost.basis()),
        TriageReport.class);
  }
}
