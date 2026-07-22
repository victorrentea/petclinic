package victor.training.petclinic.chatbot.assistant;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

/**
 * In-memory, per-owner chat transcript repainted by the UI on reload. Methods are {@code synchronized}
 * (the work inside is trivial), so plain collections suffice. Resets on restart.
 */
@Component
class ChatHistory {

  private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm:ss");

  record Entry(String role, String text, boolean inMemory, String time) {}

  private record StoredMessage(String role, String text, String time) {}

  private final Map<String, List<StoredMessage>> byOwner = new HashMap<>();

  synchronized void append(String conversationId, String role, String text) {
    byOwner.computeIfAbsent(conversationId, k -> new ArrayList<>())
        .add(new StoredMessage(role, text, LocalTime.now().format(TIME_FMT)));
  }

  synchronized void clear(String conversationId) {
    byOwner.remove(conversationId);
  }

  synchronized List<Entry> transcript(String conversationId) {
    List<StoredMessage> stored = byOwner.get(conversationId);
    if (stored == null) {
      return List.of();
    }
    // inMemory = within the model's last-N window; older ones it has already forgotten.
    int firstInMemory = Math.max(0, stored.size() - Assistant.MEMORY_WINDOW_MESSAGES);
    List<Entry> result = new ArrayList<>(stored.size());
    for (int i = 0; i < stored.size(); i++) {
      StoredMessage m = stored.get(i);
      result.add(new Entry(m.role(), m.text(), i >= firstInMemory, m.time()));
    }
    return result;
  }
}
