package victor.training.petclinic.chatbot.triage;

import com.embabel.agent.api.invocation.AgentInvocation;
import com.embabel.agent.config.annotation.EnableAgents;
import com.embabel.agent.core.AgentPlatform;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import victor.training.petclinic.chatbot.triage.PetTriageAgent.OwnerSymptom;
import victor.training.petclinic.chatbot.triage.PetTriageAgent.TriageReport;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * LIVE end-to-end test of the Embabel triage flow against a real OpenAI model. It boots a MINIMAL
 * context — Embabel auto-config + just the {@link PetTriageAgent} bean — deliberately NOT scanning
 * the package, so {@code ChatbotApp}'s fail-fast MCP client is absent (the triage agent needs no MCP).
 *
 * <p>Named {@code *IT} so the default surefire {@code *Test} run skips it (keeping CI free of OpenAI
 * cost); it also self-skips when {@code OPENAI_API_KEY} is unset. Run it explicitly:
 * {@code mvn test -Dtest=PetTriageAgentLiveIT}.
 */
@SpringBootTest(classes = PetTriageAgentLiveIT.LiveApp.class)
@EnabledIfEnvironmentVariable(named = "OPENAI_API_KEY", matches = ".+")
class PetTriageAgentLiveIT {

  @SpringBootConfiguration
  @EnableAutoConfiguration
  @EnableAgents
  @Import(PetTriageAgent.class)
  static class LiveApp {
  }

  @Autowired
  AgentPlatform agentPlatform;

  @Test
  void runs_the_full_multi_step_plan_against_a_real_llm() {
    TriageReport report = AgentInvocation.create(agentPlatform, TriageReport.class)
        .invoke(new OwnerSymptom("my dog Leo is limping and won't put weight on his leg after a fall"));

    assertThat(report).isNotNull();
    assertThat(report.markdown()).isNotBlank();
    System.out.println("\n=== Embabel TriageReport ===\n" + report.markdown() + "\n============================\n");
  }
}
