package victor.training.petclinic.chatbot;

import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.vectorstore.SimpleVectorStore;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

/**
 * Swaps the production pgvector {@code VectorStore} for an in-memory {@link SimpleVectorStore}
 * so the integration test needs NO Docker/Postgres. The {@link EmbeddingModel} is the real
 * OpenAI one (embeddings still hit the network), satisfying the {@code VectorStore} injection
 * point in {@link AssistantController} and {@link RagIngestion}.
 */
@TestConfiguration
public class TestVectorStoreConfig {

  @Bean
  SimpleVectorStore vectorStore(EmbeddingModel embeddingModel) {
    return SimpleVectorStore.builder(embeddingModel).build();
  }
}
