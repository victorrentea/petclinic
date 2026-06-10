package victor.training.petclinic.chatbot.firefighter;

import java.util.Map;

/** A few key metrics keyed by name, each value either a measurement string or "unavailable". */
public record MetricsSnapshot(Map<String, String> metrics) {}
