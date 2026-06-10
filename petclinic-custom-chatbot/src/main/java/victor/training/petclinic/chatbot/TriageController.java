package victor.training.petclinic.chatbot;

import com.embabel.agent.api.invocation.AgentInvocation;
import com.embabel.agent.core.AgentPlatform;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import victor.training.petclinic.chatbot.PetTriageAgent.OwnerSymptom;
import victor.training.petclinic.chatbot.PetTriageAgent.TriageReport;

/**
 * Exposes the Embabel {@link PetTriageAgent} as a one-shot endpoint, side-by-side with the streaming
 * {@code /assistant} chat. We just name the result type ({@link TriageReport}) and the input
 * ({@link OwnerSymptom}); Embabel's planner picks the agent and runs the action chain to reach it.
 *
 * <p>{@code AgentInvocation.invoke(...)} is blocking, so on this WebFlux app we run it on
 * {@code boundedElastic} — the same trick {@link Assistant#assistant} uses for the blocking LLM call.
 */
@RestController
class TriageController {

  private final AgentPlatform agentPlatform;

  TriageController(AgentPlatform agentPlatform) {
    this.agentPlatform = agentPlatform;
  }

  @GetMapping(value = "/triage", produces = "text/markdown")
  Mono<String> triage(@RequestParam String symptom) {
    return Mono.fromCallable(() ->
            AgentInvocation.create(agentPlatform, TriageReport.class)
                .invoke(new OwnerSymptom(symptom))
                .markdown())
        .subscribeOn(Schedulers.boundedElastic());
  }
}
