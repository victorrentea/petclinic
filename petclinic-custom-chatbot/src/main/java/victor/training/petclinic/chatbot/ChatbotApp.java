package victor.training.petclinic.chatbot;

import com.embabel.agent.config.annotation.EnableAgents;
import io.modelcontextprotocol.client.McpClient;
import io.modelcontextprotocol.client.McpSyncClient;
import io.modelcontextprotocol.client.transport.HttpClientSseClientTransport;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.vectorstore.SimpleVectorStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.web.context.WebServerInitializedEvent;
import org.springframework.context.annotation.Bean;
import org.springframework.context.event.EventListener;

@SpringBootApplication
@EnableAgents // scan @Agent beans (PetTriageAgent) and stand up the Embabel AgentPlatform
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
      @Value("${petclinic.chatbot.mcp.bearer}") String bearer) {
    var transport = HttpClientSseClientTransport.builder(url)
        .sseEndpoint("/mcp")
        .customizeRequest(rb -> rb.header("Authorization", "Bearer " + bearer))
        .build();
    var client = McpClient.sync(transport).build();
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
