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
      // TODO to collect additional info conditonally or because AI wants,
      //  turn this into an MCP tool with elicitation and connect your chatbot to it

      // /Let's say that in the triage, in the cost estimate, I would have to ask the owner whether they have a discount coupon code,
      //  because if they do, they get a 20% discount on whatever the cost is. How would I incorporate this in this workflow? This is a
      //  piece of information that probably would be wrapped in a new record called coupon code, but that's going to be needed in a later
      //  flow. In other words, can MCP ask further questions to the human in front at a later

      // It is true that, to get a question and an answer to the user, you have to have a way from this REST API, right now, to call back into the user, which is not possible over REST. You need to move to MCP, and then you will be an MCP server with a tool which is called triage. A chatbot that can get an answer from the human and ask the human a question. That chatbot would connect to this MCP, and the MCP would start the triage. If, in a later stage, it requires more information, it can use the elicitation to question the chatbot, and the chatbot will just literally ask that question to the user. Whatever the user responds, get the string back in here as a response for that elicitation, so the bubble can continue its flow. When it's done, that's your tool result.
      //
      //In the meantime, it's you, brainy, and you can also do notification for progress: step one out of 7, 2 out of 7, 8 out of 7.

    return AgentInvocation.create(agentPlatform, TriageReport.class)
        .invoke(new OwnerSymptom(symptom))
        .markdown();
  }
}
