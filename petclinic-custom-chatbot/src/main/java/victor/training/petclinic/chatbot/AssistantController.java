package victor.training.petclinic.chatbot;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Base64;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import io.modelcontextprotocol.client.McpSyncClient;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.client.advisor.vectorstore.QuestionAnswerAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.InMemoryChatMemoryRepository;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.mcp.SyncMcpToolCallbackProvider;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
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
      - After booking, confirm with the returned visit id and email the owner a short
        confirmation using the send-email tool (it always goes to the logged-in owner).

      Be concise. When unsure, ask rather than assume. Use the earlier conversation as context.
      """;

  private final ChatClient ai;

  AssistantController(
      ChatClient.Builder builder,
      VectorStore vectorStore, // interface, so tests can swap pgvector -> SimpleVectorStore
      McpSyncClient petclinicMcpClient,
      EmailTool emailTool) {
    this.ai = builder
        .defaultSystem(SYSTEM_PROMPT)
        .defaultTools(emailTool) // local tool, alongside the remote MCP tools below
        .defaultToolCallbacks(SyncMcpToolCallbackProvider.builder().mcpClients(petclinicMcpClient).build())
        .defaultAdvisors(
            // Per-conversation memory: history is keyed by conversationId (set to the username
            // per request below), so each owner has an isolated, multi-turn conversation.
            MessageChatMemoryAdvisor.builder(
                MessageWindowChatMemory.builder()
                    .chatMemoryRepository(new InMemoryChatMemoryRepository())
                    .build())
                .build(),
            QuestionAnswerAdvisor.builder(vectorStore).build()) // RAG over the specialty knowledge
        .build();
  }

  @GetMapping(value = "/{username}/assistant", produces = "text/markdown")
  Flux<String> assistant(
      @PathVariable String username,
      @RequestParam String q,
      @RequestHeader(value = "Authorization", required = false) String authorization) {
    String ownerEmail = emailFromBearer(authorization); // the web page sends the access token
    // The MCP tools are a blocking (sync) client, so run the whole ChatClient pipeline on a
    // blocking-capable scheduler — never call block() on a WebFlux event-loop thread. The owner
    // email is published into the security context on that same thread so the EmailTool can read it.
    return Flux.defer(() -> {
          OwnerContext.setEmail(ownerEmail);
          return ai.prompt()
              .system("The owner's username is \"%s\". Today is %s.".formatted(username, LocalDate.now()))
              .user(q)
              .advisors(a -> a.param(ChatMemory.CONVERSATION_ID, username)) // this owner's history
              .stream()
              .content();
        })
        .subscribeOn(Schedulers.boundedElastic())
        .doFinally(signal -> OwnerContext.clear());
  }

  private static String emailFromBearer(String authorization) {
    if (authorization == null || !authorization.startsWith("Bearer ")) {
      return "";
    }
    return emailFromJwt(authorization.substring("Bearer ".length()).trim());
  }

  /** Reads the "email" claim from the (unverified) demo JWT payload. */
  private static String emailFromJwt(String jwt) {
    try {
      String payload = new String(Base64.getUrlDecoder().decode(jwt.split("\\.")[1]), StandardCharsets.UTF_8);
      Matcher m = Pattern.compile("\"email\"\\s*:\\s*\"([^\"]+)\"").matcher(payload);
      return m.find() ? m.group(1) : "";
    } catch (RuntimeException e) {
      return "";
    }
  }
}
