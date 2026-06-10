package victor.training.petclinic.chatbot.assistant;

import java.util.Comparator;
import java.util.Map;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.metadata.Usage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.stereotype.Component;

/**
 * Turns token counts into <b>money</b>. The LLM API only ever reports TOKENS — neither OpenAI's
 * response nor Spring AI's {@link Usage} metadata carries a dollar figure — so the cost is derived
 * here as {@code tokens x price-per-token}, using a small static price table (USD per 1M tokens).
 *
 * <p>Emits a Micrometer counter that Prometheus renders as
 * {@code gen_ai_client_cost_usd_total{gen_ai_response_model="gpt-4o-mini", gen_ai_token_type="input"}}.
 * Tags mirror Spring AI's auto-recorded {@code gen_ai_client_token_usage_total}, so a Grafana panel can
 * line up tokens and spend on the same model/type dimensions.
 */
@Slf4j
@Component
class TokenCostMeter {

  /** USD per 1 token, by response-model name: {@code [inputPrice, outputPrice]}. Prices as of 2025. */
  private static final Map<String, double[]> USD_PER_TOKEN = Map.of(
      "gpt-4o-mini", new double[] {0.15 / 1_000_000, 0.60 / 1_000_000},
      "gpt-4o", new double[] {2.50 / 1_000_000, 10.00 / 1_000_000},
      "gpt-4.1-mini", new double[] {0.40 / 1_000_000, 1.60 / 1_000_000});

  private final MeterRegistry registry;

  TokenCostMeter(MeterRegistry registry) {
    this.registry = registry;
  }

  /** Reads token usage + model off the response and records the input/output spend. No-op when the */
  /** model is unpriced (e.g. a local Ollama model — free) or usage is absent. */
  void record(ChatResponse response) {
    if (response == null || response.getMetadata() == null) {
      return;
    }
    String model = response.getMetadata().getModel();
    Usage usage = response.getMetadata().getUsage();
    double[] price = priceFor(model);
    if (price == null || usage == null) {
      return; // unknown/local model or no usage reported -> nothing billable to record
    }
    recordLeg(model, "input", tokens(usage.getPromptTokens()) * price[0]);
    recordLeg(model, "output", tokens(usage.getCompletionTokens()) * price[1]);
  }

  /**
   * The response model carries a dated suffix (e.g. {@code gpt-4o-mini-2024-07-18}) while the price
   * table is keyed by family ({@code gpt-4o-mini}). Match the LONGEST key that prefixes the model, so
   * {@code gpt-4o-mini-...} resolves to {@code gpt-4o-mini} rather than the shorter {@code gpt-4o}.
   */
  private static double[] priceFor(String model) {
    if (model == null) {
      return null;
    }
    return USD_PER_TOKEN.entrySet().stream()
        .filter(e -> model.startsWith(e.getKey()))
        .max(Comparator.comparingInt(e -> e.getKey().length()))
        .map(Map.Entry::getValue)
        .orElse(null);
  }

  private void recordLeg(String model, String tokenType, double usd) {
    Counter.builder("gen_ai.client.cost")
        .baseUnit("usd")
        .description("Estimated spend on the GenAI model (token usage x list price)")
        .tag("gen_ai.response.model", model)
        .tag("gen_ai.token.type", tokenType)
        .register(registry) // idempotent: same name+tags returns the existing counter
        .increment(usd);
  }

  private static int tokens(Integer count) {
    return count == null ? 0 : count;
  }
}
