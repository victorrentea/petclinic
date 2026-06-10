package victor.training.petclinic.chatbot.triage;

import com.embabel.agent.api.invocation.AgentInvocation;
import com.embabel.agent.core.AgentPlatform;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import victor.training.petclinic.chatbot.triage.PetTriageAgent.OwnerSymptom;
import victor.training.petclinic.chatbot.triage.PetTriageAgent.TriageReport;

/**
 * Exposes the Embabel {@link PetTriageAgent} as a one-shot endpoint, side-by-side with the
 * {@code /assistant} chat. We just name the result type ({@link TriageReport}) and the input
 * ({@link OwnerSymptom}); Embabel's planner picks the agent and runs the action chain to reach it.
 *
 * <p>{@code AgentInvocation.invoke(...)} is blocking; on this MVC + virtual-threads app we simply call
 * it on the request (virtual) thread — same blocking style as {@code Assistant#assistant}.
 */
@RestController
class TriageController {

  private final AgentPlatform agentPlatform;

  TriageController(AgentPlatform agentPlatform) {
    this.agentPlatform = agentPlatform;
  }

  @GetMapping(value = "/triage", produces = "text/markdown")
  String triage(@RequestParam String symptom) {
    return AgentInvocation.create(agentPlatform, TriageReport.class)
        .invoke(new OwnerSymptom(symptom))
        .markdown();
  }
}
