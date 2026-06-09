package victor.training.petclinic.chatbot;

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

  @Bean
  McpSyncClient petclinicMcpClient(
      @Value("${petclinic.chatbot.mcp.url}") String url,
      @Value("${petclinic.chatbot.mcp.bearer}") String bearer,
      @Value("${petclinic.chatbot.demo-phone}") String phone) {
    var transport = HttpClientSseClientTransport.builder(url)
        .sseEndpoint("/mcp")
        .customizeRequest(rb -> rb.header("Authorization", "Bearer " + bearer))
        .build();
    // create_visit asks the client for a phone via MCP ELICITATION. Single-turn REST has no
    // human at the keyboard, so we auto-ACCEPT a configured demo phone here.
    // NOTE: we deliberately do NOT initialize() here. Initializing at startup hard-couples the
    // chatbot's boot to the backend being up (and a 20s handshake timeout if it isn't). Instead
    // Assistant connects lazily on the first chat request and retries until the backend is up.
    return McpClient.sync(transport)
        .elicitation(req -> new ElicitResult(ElicitResult.Action.ACCEPT, Map.of("phone", phone)))
        .capabilities(ClientCapabilities.builder().elicitation().build())
        .build();
  }
}
