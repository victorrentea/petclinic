package victor.training.petclinic.chatbot;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SimpleVectorStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationStartedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;

@Slf4j
@Component
@RequiredArgsConstructor
public class RagIngestion {
  private final SimpleVectorStore vectorStore;

  // Where the computed embeddings are cached on disk, so a restart doesn't re-embed (and re-bill).
  @Value("${petclinic.chatbot.vectorstore-file:rag-vector-store.json}")
  private String storeFile;

  @EventListener(ApplicationStartedEvent.class)
  public void ingest() throws IOException {
    File cache = new File(storeFile);
    if (cache.exists()) {
      vectorStore.load(cache);
      log.info("Loaded cached RAG embeddings from {} — skipped re-embedding", cache.getAbsolutePath());
      return;
    }

    var resource = new ClassPathResource("specialty-knowledge.md");
    String text;
    try (var in = resource.getInputStream()) {
      text = StreamUtils.copyToString(in, StandardCharsets.UTF_8);
    }

    List<Document> documents = new ArrayList<>();
    for (String section : text.split("(?m)^(?=## )")) {
      String trimmed = section.strip();
      if (!trimmed.isEmpty()) {
        documents.add(new Document(trimmed));
      }
    }

    vectorStore.add(documents);
    vectorStore.save(cache);
    log.info("Vectorized {} specialty sections and cached them to {}", documents.size(), cache.getAbsolutePath());
  }
}
