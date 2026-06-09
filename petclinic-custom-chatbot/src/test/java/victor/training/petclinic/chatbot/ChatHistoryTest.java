package victor.training.petclinic.chatbot;

import java.util.List;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pure-unit test (no Spring, no OpenAI) for the per-owner transcript and the in-memory/forgotten
 * flagging. The flag MUST track {@link Assistant#MEMORY_WINDOW_MESSAGES} — the same constant the
 * {@code MessageWindowChatMemory} is configured with — so the UI dims exactly what the model forgot.
 */
class ChatHistoryTest {

  @Test
  void isolates_transcripts_per_owner() {
    ChatHistory history = new ChatHistory();
    history.append("alice", "user", "hi from alice");
    history.append("bob", "user", "hi from bob");

    assertThat(history.transcript("alice")).extracting(ChatHistory.Entry::text).containsExactly("hi from alice");
    assertThat(history.transcript("bob")).extracting(ChatHistory.Entry::text).containsExactly("hi from bob");
  }

  @Test
  void unknown_owner_has_empty_transcript() {
    assertThat(new ChatHistory().transcript("nobody")).isEmpty();
  }

  @Test
  void flags_only_the_last_N_messages_as_in_memory() {
    ChatHistory history = new ChatHistory();
    int total = Assistant.MEMORY_WINDOW_MESSAGES + 2; // two older messages must be "forgotten"
    for (int i = 0; i < total; i++) {
      history.append("george", i % 2 == 0 ? "user" : "assistant", "msg " + i);
    }

    List<ChatHistory.Entry> entries = history.transcript("george");
    assertThat(entries).hasSize(total);

    long inMemory = entries.stream().filter(ChatHistory.Entry::inMemory).count();
    assertThat(inMemory).isEqualTo(Assistant.MEMORY_WINDOW_MESSAGES);

    // The forgotten ones are the OLDEST (first two); the freshest N stay in memory.
    assertThat(entries.get(0).inMemory()).isFalse();
    assertThat(entries.get(1).inMemory()).isFalse();
    assertThat(entries.get(2).inMemory()).isTrue();
    assertThat(entries.get(total - 1).inMemory()).isTrue();
  }

  @Test
  void all_messages_in_memory_when_below_the_window() {
    ChatHistory history = new ChatHistory();
    history.append("small", "user", "only one");

    assertThat(history.transcript("small")).singleElement()
        .satisfies(e -> assertThat(e.inMemory()).isTrue());
  }
}
