package victor.training.petclinic.chatbot;

import java.time.LocalDate;
import java.util.Map;

import io.modelcontextprotocol.client.McpSyncClient;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.client.advisor.vectorstore.QuestionAnswerAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.InMemoryChatMemoryRepository;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.mcp.SyncMcpToolCallbackProvider;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;
import reactor.core.scheduler.Schedulers;

@RestController
public class Assistant {

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
      - To resolve relative times like "now", "in 1 hour" or "tomorrow", call the
        current-date-time tool for the exact current time — never guess what time it is now.
      - Then call the `create_visit` tool for that pet with a FUTURE date and time and a
        description that summarizes the symptom and the chosen specialty.
      - After booking, confirm with the returned visit id and email the owner a short
        confirmation using the send-email tool (it always goes to the logged-in owner).

      Keep your answers concise and helpful. When unsure, ask rather than assume, and use the
      earlier conversation as context.
      """;

  private final ChatClient ai;

  Assistant(
      ChatClient.Builder builder,
      VectorStore vectorStore, // interface, so tests can swap pgvector -> SimpleVectorStore
      McpSyncClient petclinicMcpClient,
      LocalTools localTools) {
    this.ai = builder
        .defaultSystem(SYSTEM_PROMPT)
        .defaultTools(localTools) // local tools (clock, email), alongside the remote MCP tools below
        .defaultToolCallbacks(SyncMcpToolCallbackProvider.builder().mcpClients(petclinicMcpClient).build())
        .defaultAdvisors(
            chatMemoryAdvisor(),
            QuestionAnswerAdvisor.builder(vectorStore).build()) // RAG over the specialty knowledge
        .build();
  }

    /**
     * Per-conversation memory: history is keyed by conversationId (set to the owner's name per
     * request), so each owner has an isolated, multi-turn conversation. In-memory only — it resets
     * on restart, which is fine for this demo.
     */
    private static MessageChatMemoryAdvisor chatMemoryAdvisor() {
        return MessageChatMemoryAdvisor.builder(
                MessageWindowChatMemory.builder()
                    .chatMemoryRepository(new InMemoryChatMemoryRepository())
                    .build())
            .build();
    }

  @GetMapping(value = "/assistant", produces = "text/markdown")
  Flux<String> assistant(@RequestParam String message, @AuthenticationPrincipal OwnerJwtPrincipal owner) {
    // owner is never null here: SecurityConfig's anyExchange().authenticated() rule makes the filter
    // chain reject unauthenticated /assistant requests with 401 before this controller is reached.
    // defer + subscribeOn: ChatClient.stream() eagerly resolves the MCP tools via a BLOCKING
    // listTools(), and every MCP tool call blocks too. defer postpones that to subscription time so
    // it all runs on boundedElastic (blocking-allowed); without it, listTools() blocks a non-blocking
    // reactor thread and throws "block()/blockFirst()/blockLast() are blocking".
    return Flux.defer(() -> ai.prompt()
            .system("The owner's username is \"%s\". Today is %s.".formatted(owner.name(), LocalDate.now()))
            .user(message)
            .toolContext(Map.of(LocalTools.OWNER_EMAIL, owner.email())) // owner email for the email tool
            .advisors(a -> a.param(ChatMemory.CONVERSATION_ID, owner.name())) // this owner's history
            .stream()
            .content())
        .subscribeOn(Schedulers.boundedElastic());
  }
}
