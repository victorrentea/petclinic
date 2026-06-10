package victor.training.petclinic.chatbot.assistant;

import java.time.Duration;
import java.time.LocalDateTime;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LocalToolsTest {

  @Test
  void returns_the_current_date_time() {
    String now = new LocalTools().currentDateTime();
    LocalDateTime parsed = LocalDateTime.parse(now); // must be valid ISO-8601
    assertThat(Duration.between(parsed, LocalDateTime.now()).abs()).isLessThan(Duration.ofMinutes(1));
  }
}
