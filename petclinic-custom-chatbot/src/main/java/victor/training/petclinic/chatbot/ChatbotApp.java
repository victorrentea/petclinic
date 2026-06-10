package victor.training.petclinic.chatbot;

import com.embabel.agent.config.annotation.EnableAgents;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.vectorstore.SimpleVectorStore;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.web.context.WebServerInitializedEvent;
import org.springframework.context.annotation.Bean;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableAgents // scan @Agent beans (PetTriageAgent) and stand up the Embabel AgentPlatform
@EnableScheduling // drives RagIngestion's every-3s poll of the backend specialty feed
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
}
