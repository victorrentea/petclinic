package victor.training.petclinic.chatbot.firefighter;

import com.embabel.agent.api.invocation.AgentInvocation;
import com.embabel.agent.core.AgentPlatform;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import victor.training.petclinic.chatbot.firefighter.FirefighterAgent.Incident;
import victor.training.petclinic.chatbot.firefighter.FirefighterAgent.IncidentReport;

/**
 * Triggers the Embabel {@link FirefighterAgent} as a one-shot endpoint (sibling of
 * {@code TriageController}). We name the result type ({@link IncidentReport}) and the input
 * ({@link Incident}); Embabel's planner runs the action chain to reach it (assess → metrics/Grafana →
 * guarded recover → report). Returns a Markdown incident report.
 *
 * <p>{@code AgentInvocation.invoke(...)} is blocking; on this MVC + virtual-threads app we call it on
 * the request (virtual) thread, same style as {@code TriageController}. Sits behind the existing
 * {@code SecurityConfig} (Bearer required).
 */
@RestController
class FirefighterController {

  private final AgentPlatform agentPlatform;

  FirefighterController(AgentPlatform agentPlatform) {
    this.agentPlatform = agentPlatform;
  }

  @GetMapping(value = "/firefighter", produces = "text/markdown")
  String firefighter(
      @RequestParam(defaultValue = "Routine health sweep of PetClinic services") String incident) {
    return AgentInvocation.create(agentPlatform, IncidentReport.class)
        .invoke(new Incident(incident))
        .markdown();
  }
}
