package victor.training.petclinic.chatbot;

import java.time.Duration;
import java.util.Map;

import io.modelcontextprotocol.client.McpClient;
import io.modelcontextprotocol.client.McpSyncClient;
import io.modelcontextprotocol.client.transport.HttpClientSseClientTransport;
import io.modelcontextprotocol.spec.McpSchema.ClientCapabilities;
import io.modelcontextprotocol.spec.McpSchema.ElicitResult;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.vectorstore.SimpleVectorStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.web.context.WebServerInitializedEvent;
import org.springframework.context.annotation.Bean;
import org.springframework.context.event.EventListener;

@SpringBootApplication
public class ChatbotApp {

  public static void main(String[] args) {
    SpringApplication.run(ChatbotApp.class, args);
  }

  @EventListener
  void started(WebServerInitializedEvent event) {
    System.out.println("✅ started petclinic-custom-chatbot on port " + event.getWebServer().getPort());
  }

  @Bean
  SimpleVectorStore vectorStore(EmbeddingModel embeddingModel) {
    // In-memory vector store — no Postgres/Docker needed to run the workshop.
    // RagIngestion persists it to disk so embeddings survive restarts (no re-embedding cost).
    return SimpleVectorStore.builder(embeddingModel).build();
  }

  /** How long a parked elicitation waits for the human at the browser before it auto-declines. */
  private static final Duration ELICITATION_TIMEOUT = Duration.ofSeconds(120);

  @Bean
  McpSyncClient petclinicMcpClient(
      @Value("${petclinic.chatbot.mcp.url}") String url,
      @Value("${petclinic.chatbot.mcp.bearer}") String bearer,
      PendingElicitations elicitations) {
    var transport = HttpClientSseClientTransport.builder(url)
        .sseEndpoint("/mcp")
        .customizeRequest(rb -> rb.header("Authorization", "Bearer " + bearer))
        .build();
    // create_visit asks the client for a phone via MCP ELICITATION. We surface it in the browser:
    // the registry knows which owner's chat is running (the SDK runs this handler on its OWN thread,
    // so we can't use a ThreadLocal — see PendingElicitations.currentOwner), parks the request, and
    // BLOCKS until the page POSTs the phone (or times out -> DECLINE).
    var client = McpClient.sync(transport)
        .elicitation(req -> {
          String owner = elicitations.currentOwner();
          if (owner == null) {
            return new ElicitResult(ElicitResult.Action.DECLINE, Map.of());
          }
          return elicitations.await(owner, req, ELICITATION_TIMEOUT);
        })
        .capabilities(ClientCapabilities.builder().elicitation().build())
        .build();
    // Fail fast: the chatbot is useless without its tools, so refuse to start if the backend is down.
    try {
      client.initialize();
    } catch (Exception e) {
      throw new RuntimeException(
          "The petclinic MCP server at " + url + " is unreachable — start the backend first.", e);
    }
    return client;
  }
}
