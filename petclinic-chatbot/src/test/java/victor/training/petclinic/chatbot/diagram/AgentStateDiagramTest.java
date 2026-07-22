package victor.training.petclinic.chatbot.diagram;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

import victor.training.petclinic.chatbot.firefighter.FirefighterAgent;
import victor.training.petclinic.chatbot.triage.PetTriageAgent;

/**
 * Deterministic, OFFLINE test for {@link AgentStateDiagram}: it renders BOTH agents purely by
 * reflection (no OpenAI, no MCP, no Spring context, no network), writes the two .puml files as a
 * side effect, and asserts on the rendered strings. NOT gated on any env var.
 */
class AgentStateDiagramTest {

  /** Committed output directory for the generated diagrams. */
  private static final Path DIAGRAMS_DIR = Path.of("docs", "diagrams");

  @Test
  void triageDiagram() throws IOException {
    String puml = AgentStateDiagram.render(PetTriageAgent.class);
    writeDiagram("triage.puml", puml);

    assertThat(puml).startsWith("@startuml").endsWith("@enduml\n");
    // Entry state + the two assessments derivable from the symptom.
    assertThat(puml).contains("[*] --> OwnerSymptom");
    assertThat(puml).contains("OwnerSymptom --> UrgencyAssessment : assessUrgency");
    assertThat(puml).contains("OwnerSymptom --> SpecialtyRecommendation : recommendSpecialty");
    // Cost is computed from the two assessments, then the goal report ends the flow.
    assertThat(puml).contains("CostEstimate");
    assertThat(puml).contains("SpecialtyRecommendation --> CostEstimate : estimateCost");
    assertThat(puml).contains("UrgencyAssessment --> CostEstimate : estimateCost");
    assertThat(puml).contains("CostEstimate --> TriageReport : report");
    assertThat(puml).contains("TriageReport --> [*]");
    // OperationContext is an injected service — must NOT become a state/transition.
    assertThat(puml).doesNotContain("OperationContext");
  }

  @Test
  void firefighterDiagram() throws IOException {
    String puml = AgentStateDiagram.render(FirefighterAgent.class);
    writeDiagram("firefighter.puml", puml);

    assertThat(puml).startsWith("@startuml").endsWith("@enduml\n");
    // Entry incident -> health -> metrics/grafana -> recover -> report chain.
    assertThat(puml).contains("[*] --> Incident");
    assertThat(puml).contains("Incident --> HealthSnapshot : assessHealth");
    assertThat(puml).contains("HealthSnapshot --> MetricsSnapshot : readMetrics");
    assertThat(puml).contains("HealthSnapshot --> GrafanaFindings : queryGrafana");
    assertThat(puml).contains("GrafanaFindings --> RecoveryOutcome : recover");
    assertThat(puml).contains("RecoveryOutcome --> IncidentReport : report");
    assertThat(puml).contains("IncidentReport --> [*]");
    // Injected services (HealthProbe, GrafanaClient, OperationContext) must NOT appear.
    assertThat(puml).doesNotContain("HealthProbe");
    assertThat(puml).doesNotContain("GrafanaClient");
    assertThat(puml).doesNotContain("OperationContext");
  }

  private static void writeDiagram(String fileName, String content) throws IOException {
    Files.createDirectories(DIAGRAMS_DIR);
    Files.writeString(DIAGRAMS_DIR.resolve(fileName), content, StandardCharsets.UTF_8);
  }
}
