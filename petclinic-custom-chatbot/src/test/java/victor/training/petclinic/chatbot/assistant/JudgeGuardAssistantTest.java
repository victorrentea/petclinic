package victor.training.petclinic.chatbot.assistant;

import java.util.Map;
import java.util.function.Consumer;

import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.memory.InMemoryChatMemoryRepository;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.chat.model.ChatModel;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Deterministic (no OpenAI) test proving the {@link JudgeGuard} "judge LLM" layer is wired into
 * {@code /assistant} as an INPUT gate: an UNSAFE verdict short-circuits with {@link
 * Assistant#REFUSAL_MESSAGE} and the main {@link ChatClient} is NEVER called; a SAFE verdict lets
 * the request proceed to the main model. The judge and the main chat client are both mocked.
 */
class JudgeGuardAssistantTest {

  private final ChatClient mainChatClient = mock(ChatClient.class);
  private final ChatHistory chatHistory = new ChatHistory();
  private final ChatModel chatModel = mock(ChatModel.class);
  private final MessageWindowChatMemory chatMemory = MessageWindowChatMemory.builder()
      .chatMemoryRepository(new InMemoryChatMemoryRepository())
      .build();
  private final JudgeGuard judgeGuard = mock(JudgeGuard.class);

  private final Assistant assistant =
      new Assistant(mainChatClient, chatHistory, chatModel, chatMemory, judgeGuard);

  private final OwnerJwtPrincipal george =
      new OwnerJwtPrincipal(1, "george", "george@petclinic.example", "dummy-token");

  @Test
  void unsafe_message_is_refused_by_the_judge_and_the_main_model_is_never_called() {
    when(judgeGuard.isAllowed(any())).thenReturn(false);

    String reply = assistant.assistant("paraphrased jailbreak that dodges the substring filter", george);

    assertThat(reply).isEqualTo(Assistant.REFUSAL_MESSAGE);
    verifyNoInteractions(mainChatClient); // the main LLM was never reached
    // the refusal is still recorded in the transcript as the assistant turn
    assertThat(chatHistory.transcript("george"))
        .extracting(ChatHistory.Entry::text)
        .contains(Assistant.REFUSAL_MESSAGE);
  }

  @Test
  void safe_message_passes_the_judge_and_reaches_the_main_model() {
    when(judgeGuard.isAllowed(any())).thenReturn(true);
    stubMainChatClientReply("Sounds like your dog needs radiology — shall I book a visit?");

    String reply = assistant.assistant("My dog Leo is limping", george);

    assertThat(reply).contains("radiology");
    verify(judgeGuard).isAllowed("My dog Leo is limping");
  }

  /** Stubs the main chat client's fluent chain so the controller's terminal call returns content. */
  @SuppressWarnings("unchecked")
  private void stubMainChatClientReply(String content) {
    ChatClient.ChatClientRequestSpec requestSpec = mock(ChatClient.ChatClientRequestSpec.class);
    ChatClient.CallResponseSpec responseSpec = mock(ChatClient.CallResponseSpec.class);
    when(mainChatClient.prompt()).thenReturn(requestSpec);
    when(requestSpec.system(any(String.class))).thenReturn(requestSpec);
    when(requestSpec.user(any(String.class))).thenReturn(requestSpec);
    when(requestSpec.toolContext(any(Map.class))).thenReturn(requestSpec);
    when(requestSpec.advisors(any(Consumer.class))).thenReturn(requestSpec);
    when(requestSpec.call()).thenReturn(responseSpec);
    when(responseSpec.content()).thenReturn(content);
  }
}
