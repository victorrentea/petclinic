package victor.training.petclinic.chatbot;

import java.util.Map;

import io.modelcontextprotocol.client.McpClient;
import io.modelcontextprotocol.client.McpSyncClient;
import io.modelcontextprotocol.client.transport.HttpClientSseClientTransport;
import io.modelcontextprotocol.spec.McpSchema.ClientCapabilities;
import io.modelcontextprotocol.spec.McpSchema.ElicitResult;
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
  McpSyncClient petclinicMcpClient(
      @Value("${petclinic.chatbot.mcp.url}") String url,
      @Value("${petclinic.chatbot.mcp.bearer}") String bearer,
      @Value("${petclinic.chatbot.demo-phone}") String phone) {
    var transport = HttpClientSseClientTransport.builder(url)
        .sseEndpoint("/mcp")
        .customizeRequest(rb -> rb.header("Authorization", "Bearer " + bearer))
        .build();
    // create_visit asks the client for a phone via MCP ELICITATION. Single-turn REST has no
    // human at the keyboard, so we auto-ACCEPT a configured demo phone here. (The reference
    // AiApp used .sampling(...) for its remote SMS tool instead.)
    var client = McpClient.sync(transport)
        .elicitation(req -> new ElicitResult(ElicitResult.Action.ACCEPT, Map.of("phone", phone)))
        .capabilities(ClientCapabilities.builder().elicitation().build())
        .build();
    try {
      client.initialize();
    } catch (Exception e) {
      throw new RuntimeException(
          "The petclinic MCP server at " + url + " is unreachable — start the backend first.", e);
    }
    return client;
  }
}
