package victor.training.petclinic.chatbot.assistant;

import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.memory.InMemoryChatMemoryRepository;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Deterministic (no OpenAI) test proving the {@link JudgeGuard} "judge LLM" layer is wired into
 * {@code /assistant} as both an INPUT and an OUTPUT gate. INPUT: an UNSAFE message short-circuits
 * with {@link Assistant#REFUSAL_MESSAGE} and the main {@link ChatClient} is NEVER called. OUTPUT:
 * a safe message reaches the model, but an UNSAFE reply verdict replaces the content with the
 * refusal. A safe-in / safe-out request passes through untouched. Both judges and the main chat
 * client are mocked.
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
      new Assistant(mainChatClient, chatHistory, chatModel, chatMemory, judgeGuard,
          new TokenCostMeter(new SimpleMeterRegistry()));

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
  void safe_message_and_safe_reply_pass_both_gates_and_reach_the_owner() {
    when(judgeGuard.isAllowed(any())).thenReturn(true);
    when(judgeGuard.isReplyAllowed(any(), any())).thenReturn(true);
    stubMainChatClientReply("Sounds like your dog needs radiology — shall I book a visit?");

    String reply = assistant.assistant("My dog Leo is limping", george);

    assertThat(reply).contains("radiology");
    verify(judgeGuard).isAllowed("My dog Leo is limping");
  }

  @Test
  void safe_message_but_unsafe_reply_is_replaced_with_the_refusal() {
    when(judgeGuard.isAllowed(any())).thenReturn(true);
    when(judgeGuard.isReplyAllowed(any(), any())).thenReturn(false);
    stubMainChatClientReply("Here is a Python script that scrapes a website...");

    String reply = assistant.assistant("My dog Leo is limping", george);

    assertThat(reply).isEqualTo(Assistant.REFUSAL_MESSAGE);
    // the OUTPUT-gate refusal (not the model's drift) is what lands in the transcript
    assertThat(chatHistory.transcript("george"))
        .extracting(ChatHistory.Entry::text)
        .contains(Assistant.REFUSAL_MESSAGE)
        .doesNotContain("Here is a Python script that scrapes a website...");
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
    ChatResponse chatResponse = new ChatResponse(List.of(new Generation(new AssistantMessage(content))));
    when(responseSpec.chatResponse()).thenReturn(chatResponse);
  }
}
