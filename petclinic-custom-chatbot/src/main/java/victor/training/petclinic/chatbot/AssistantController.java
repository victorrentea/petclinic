package victor.training.petclinic.chatbot;

import java.time.LocalDate;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import io.modelcontextprotocol.client.McpSyncClient;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.PromptChatMemoryAdvisor;
import org.springframework.ai.chat.client.advisor.vectorstore.QuestionAnswerAdvisor;
import org.springframework.ai.chat.memory.InMemoryChatMemoryRepository;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.mcp.SyncMcpToolCallbackProvider;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;
import reactor.core.scheduler.Schedulers;

@RestController
public class AssistantController {

  static final String SYSTEM_PROMPT = """
      You are the PetClinic triage assistant for a veterinary clinic.

      How you help an owner:
      1. Listen to the symptom the owner describes for their pet.
      2. From the retrieved specialty knowledge, identify the SINGLE most relevant vet
         specialty (e.g. radiology, surgery, dentistry) for that symptom. Only use the
         specialties present in the retrieved knowledge; if none clearly fits, say so and
         ask a clarifying question instead of guessing.
      3. Give brief, practical care guidance for the symptom in the meantime.
      4. Name the recommended specialty explicitly (e.g. "I recommend our radiology service")
         and offer to book a visit with it.

      Booking rules (only after the owner agrees):
      - Read the owner's profile and pets from the `me://petclinic-owner-profile` resource.
      - ALWAYS confirm WHICH pet the visit is for before booking. If the owner has more than
        one pet, ask which one — never guess.
      - Then call the `create_visit` tool for that pet with a FUTURE date and time and a
        description that summarizes the symptom and the chosen specialty.
      - Today's date is supplied to you by the system — use it to pick a valid future date,
        and ask the owner for their preferred day/time rather than silently defaulting.
      - After booking, confirm back to the owner with the returned visit id.

      Be concise. When unsure, ask rather than assume.
      """;

  private final ChatClient ai;
  private final Map<String, PromptChatMemoryAdvisor> memory = new ConcurrentHashMap<>();

  AssistantController(
      ChatClient.Builder builder,
      VectorStore vectorStore, // interface, so tests can swap pgvector -> SimpleVectorStore
      McpSyncClient petclinicMcpClient) {
    this.ai = builder
        .defaultSystem(SYSTEM_PROMPT)
        .defaultToolCallbacks(SyncMcpToolCallbackProvider.builder().mcpClients(petclinicMcpClient).build())
        .defaultAdvisors(QuestionAnswerAdvisor.builder(vectorStore).build())
        .build();
  }

  @GetMapping(value = "/{username}/assistant", produces = "text/markdown")
  Flux<String> assistant(@PathVariable String username, @RequestParam String q) {
    var mem = memory.computeIfAbsent(username, k -> memoryAdvisor());
    // The MCP tools are a blocking (sync) client, so run the whole ChatClient pipeline on a
    // blocking-capable scheduler — never call block() on a WebFlux event-loop thread.
    return Flux.defer(() -> ai.prompt()
            .system("The owner's username is \"%s\". Today is %s.".formatted(username, LocalDate.now()))
            .user(q)
            .advisors(mem)
            .stream()
            .content())
        .subscribeOn(Schedulers.boundedElastic());
  }

  private PromptChatMemoryAdvisor memoryAdvisor() {
    return PromptChatMemoryAdvisor.builder(
            MessageWindowChatMemory.builder()
                .chatMemoryRepository(new InMemoryChatMemoryRepository())
                .build())
        .build();
  }
}
