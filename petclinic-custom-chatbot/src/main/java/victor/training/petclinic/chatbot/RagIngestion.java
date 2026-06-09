package victor.training.petclinic.chatbot;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.boot.context.event.ApplicationStartedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;

@Slf4j
@Component
@RequiredArgsConstructor
public class RagIngestion {
  private final VectorStore vectorStore;

  @EventListener(ApplicationStartedEvent.class)
  public void ingest() throws IOException {
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
    log.info("Vectorized {} specialty sections", documents.size());
  }
}
