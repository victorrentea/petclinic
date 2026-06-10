package victor.training.petclinic.chatbot;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

/**
 * In-memory, per-owner FULL chat transcript — the UI repaints it on page reload so the conversation
 * survives navigation (the model's own {@code MessageWindowChatMemory} only keeps the last N).
 *
 * <p>Keyed by owner name (the same value used as the {@code conversationId}), so each owner has an
 * isolated transcript. Thread-safe: a {@link ConcurrentHashMap} of synchronized lists, since
 * concurrent requests (each on its own virtual thread) may append in parallel. In-memory only —
 * resets on restart, which is fine for this demo.
 */
@Component
class ChatHistory {

  /** Wall-clock time (HH:mm:ss) stamped when a message is recorded, so it survives a page reload. */
  private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm:ss");

  /** One transcript line. {@code inMemory} = still inside the model's window (see flagging below). */
  record Entry(String role, String text, boolean inMemory, String time) {}

  private final Map<String, List<StoredMessage>> byOwner = new ConcurrentHashMap<>();

  private record StoredMessage(String role, String text, String time) {}

  /** Append one message (user or assistant) to this owner's transcript, stamped with the current time. */
  void append(String conversationId, String role, String text) {
    byOwner.computeIfAbsent(conversationId, k -> Collections.synchronizedList(new ArrayList<>()))
        .add(new StoredMessage(role, text, LocalTime.now().format(TIME_FMT)));
  }

  /** Forget this owner's entire transcript (the Clear button). */
  void clear(String conversationId) {
    byOwner.remove(conversationId);
  }

  /**
   * The owner's full transcript, oldest first, each flagged {@code inMemory=true} for the last
   * {@link Assistant#MEMORY_WINDOW_MESSAGES} messages (still in the model's context window) and
   * {@code false} for the older ones it has already forgotten.
   */
  List<Entry> transcript(String conversationId) {
    List<StoredMessage> stored = byOwner.get(conversationId);
    if (stored == null) {
      return List.of();
    }
    List<StoredMessage> snapshot;
    synchronized (stored) {
      snapshot = new ArrayList<>(stored);
    }
    int firstInMemoryIndex = Math.max(0, snapshot.size() - Assistant.MEMORY_WINDOW_MESSAGES);
    List<Entry> result = new ArrayList<>(snapshot.size());
    for (int i = 0; i < snapshot.size(); i++) {
      StoredMessage m = snapshot.get(i);
      result.add(new Entry(m.role(), m.text(), i >= firstInMemoryIndex, m.time()));
    }
    return result;
  }
}
