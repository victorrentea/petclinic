package victor.training.petclinic.chatbot.assistant;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SimpleVectorStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Keeps the RAG vector store in sync with the backend by <b>polling</b> {@code GET
 * /api/specialties/feed} every few seconds. The chatbot is the only side that knows about the backend;
 * the backend knows nothing about the chatbot. The feed is ETag-guarded, so an unchanged poll returns
 * 304 and we do nothing — no log line, no embedding, no cost.
 *
 * <p>On a real change (200) we (re)embed each specialty's {@code description} — the symptom text that
 * identifies the specialty — into the in-memory {@link SimpleVectorStore}. Embeddings plus the last
 * ETag are cached on disk, so a restart with no backend change reloads them and the first poll is a
 * silent 304 — no re-embedding, no re-billing. No Postgres client, no Docker.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RagIngestion {
  private final SimpleVectorStore vectorStore;
  private final ObjectMapper objectMapper = new ObjectMapper();

  @Value("${petclinic.chatbot.backend-url:http://localhost:8080}")
  private String backendUrl;

  /** Where the computed embeddings are cached on disk, so a restart doesn't re-embed (and re-bill). */
  @Value("${petclinic.chatbot.vectorstore-file:rag-vector-store.json}")
  private String storeFile;

  private RestClient restClient;
  private volatile String lastEtag;
  private volatile List<Integer> embeddedSpecialtyIds = List.of();
  private volatile boolean reachable = true; // gates the "poll failed" warning so it logs once, not every 3s

  /** Feed payload from the backend (extra fields are ignored — see fail-on-unknown-properties=false). */
  private record Item(Integer id, String name, String description) {}

  /** Disk sidecar next to the vector-store file: lets a restart skip re-embedding. */
  private record Sidecar(String etag, List<Integer> specialtyIds) {}

  @PostConstruct
  void init() {
    restClient = RestClient.create(backendUrl);
    restoreFromDisk();
  }

  /** Reload cached embeddings + last ETag so an unchanged backend yields a silent 304 poll. */
  private void restoreFromDisk() {
    File store = new File(storeFile);
    File meta = metaFile();
    if (!store.exists() || !meta.exists()) {
      return;
    }
    try {
      vectorStore.load(store);
      Sidecar sidecar = objectMapper.readValue(meta, Sidecar.class);
      lastEtag = sidecar.etag();
      embeddedSpecialtyIds = sidecar.specialtyIds() == null ? List.of() : sidecar.specialtyIds();
      log.info("Restored RAG from disk: {} specialties, etag {} — no re-embedding",
          embeddedSpecialtyIds.size(), lastEtag);
    } catch (Exception e) {
      log.warn("Could not restore RAG from disk ({}); will re-embed on the next poll", e.toString());
      lastEtag = null;
      embeddedSpecialtyIds = List.of();
    }
  }

  @Scheduled(fixedDelayString = "${petclinic.chatbot.poll-ms:3000}", initialDelay = 0)
  synchronized void poll() {
    try {
      restClient.get()
          .uri("/api/specialties/feed")
          .headers(h -> {
            if (lastEtag != null) {
              h.setIfNoneMatch(lastEtag);
            }
          })
          .exchange((request, response) -> {
            int status = response.getStatusCode().value();
            if (status == 200) {
              List<Item> items = response.bodyTo(new ParameterizedTypeReference<List<Item>>() {});
              applyChange(items == null ? List.of() : items, response.getHeaders().getETag());
            }
            return null; // 304 (unchanged) falls through here — nothing to do, and deliberately no log
          });
      reachable = true;
    } catch (Exception e) {
      if (reachable) { // log only on the first failure, then stay quiet until the backend is back
        log.warn("Specialty feed poll failed ({}); will keep retrying every few seconds", e.toString());
        reachable = false;
      }
    }
  }

  private void applyChange(List<Item> items, String etag) {
    if (!embeddedSpecialtyIds.isEmpty()) {
      vectorStore.delete(embeddedSpecialtyIds.stream().map(RagIngestion::docId).toList());
    }

    List<Document> documents = new ArrayList<>();
    List<Integer> ids = new ArrayList<>();
    for (Item item : items) {
      ids.add(item.id());
      if (item.description() == null || item.description().isBlank()) {
        continue; // nothing to embed
      }
      documents.add(new Document(docId(item.id()), item.name() + "\n" + item.description().strip(),
          Map.of("name", item.name(), "specialtyId", String.valueOf(item.id()))));
    }
    if (!documents.isEmpty()) {
      vectorStore.add(documents); // embeds the specialty-identifying description
    }
    embeddedSpecialtyIds = ids;
    lastEtag = etag;
    persist(new Sidecar(etag, ids));
    log.info("RAG updated from backend: {} specialties embedded (etag {})", documents.size(), etag);
  }

  private void persist(Sidecar sidecar) {
    try {
      vectorStore.save(new File(storeFile));
      objectMapper.writeValue(metaFile(), sidecar);
    } catch (Exception e) {
      log.warn("Could not persist RAG to disk: {}", e.toString());
    }
  }

  private File metaFile() {
    return new File(storeFile + ".meta.json");
  }

  private static String docId(Integer specialtyId) {
    return "specialty:" + specialtyId;
  }
}
