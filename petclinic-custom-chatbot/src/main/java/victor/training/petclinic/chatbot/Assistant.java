package victor.training.petclinic.chatbot;

import java.time.LocalDate;
import java.util.Map;

import io.modelcontextprotocol.client.McpSyncClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.client.advisor.vectorstore.QuestionAnswerAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.InMemoryChatMemoryRepository;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.mcp.SyncMcpToolCallbackProvider;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.scheduler.Schedulers;

@Slf4j
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
  private final McpSyncClient mcp;
  private final SyncMcpToolCallbackProvider mcpTools;
  private volatile boolean mcpReady;

  Assistant(
      ChatClient.Builder builder,
      VectorStore vectorStore, // interface, so tests can swap pgvector -> SimpleVectorStore
      McpSyncClient petclinicMcpClient,
      LocalTools localTools) {
    this.mcp = petclinicMcpClient;
    // Remote MCP tools are resolved per request (see mcpToolCallbacks), NOT wired at startup — so
    // the chatbot boots even when the backend is down and picks the tools up once it's reachable.
    this.mcpTools = SyncMcpToolCallbackProvider.builder().mcpClients(petclinicMcpClient).build();
    this.ai = builder
        .defaultSystem(SYSTEM_PROMPT)
        .defaultTools(localTools) // local tools (clock, email); remote MCP tools added per request
        .defaultAdvisors(
            chatMemoryAdvisor(),
            QuestionAnswerAdvisor.builder(vectorStore).build()) // RAG over the specialty knowledge
        .build();
  }

  @GetMapping(value = "/assistant", produces = "text/markdown")
  Flux<String> assistant(@RequestParam String message, @AuthenticationPrincipal OwnerJwtPrincipal owner) {
    if (owner == null) { // no/invalid Bearer token -> SecurityConfig left the request unauthenticated
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "A valid Bearer token is required.");
    }
    // The AI + MCP calls are blocking, so build and run the whole pipeline off the Netty event loop.
    return Flux.defer(() -> ai.prompt()
            .system("The owner's username is \"%s\". Today is %s.".formatted(owner.name(), LocalDate.now()))
            .user(message)
            .toolContext(Map.of(LocalTools.OWNER_EMAIL, owner.email())) // owner email for the email tool
            .toolCallbacks(mcpToolCallbacks())                          // remote petclinic MCP tools
            .advisors(a -> a.param(ChatMemory.CONVERSATION_ID, owner.name())) // this owner's history
            .stream()
            .content())
        .subscribeOn(Schedulers.boundedElastic());
  }

  /**
   * Connects to the petclinic MCP server on first use and retries on every later request until it's
   * up. While it's unreachable, the assistant still answers — just with the local tools only.
   */
  private ToolCallback[] mcpToolCallbacks() {
    try {
      if (!mcpReady) {
        mcp.initialize();
        mcpReady = true;
      }
      return mcpTools.getToolCallbacks();
    } catch (RuntimeException e) {
      mcpReady = false; // retry on the next request once the backend comes back
      log.warn("Petclinic MCP server unreachable — answering with local tools only ({})", e.toString());
      return new ToolCallback[0];
    }
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
}
