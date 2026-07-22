package victor.training.petclinic.chatbot.firefighter;

/** Liveness of one managed service: {@code up}, with a short {@code detail} (probe + raw status). */
public record ServiceHealth(Service service, boolean up, String detail) {}
