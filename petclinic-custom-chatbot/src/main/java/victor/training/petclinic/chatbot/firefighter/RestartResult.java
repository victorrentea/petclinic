package victor.training.petclinic.chatbot.firefighter;

/**
 * Outcome of asking {@link FirefighterGuard} to restart a service: whether it was {@code accepted}
 * (and therefore actually killed+relaunched) and a human-readable {@code reason} — the rejection
 * cause when refused (out of order, per-service cap, already escalated), or a short note when
 * accepted. {@code escalationTriggered} is true on the single restart that trips the 3-total cap.
 */
public record RestartResult(Service service, boolean accepted, String reason, boolean escalationTriggered) {

  static RestartResult accepted(Service service, String reason, boolean escalationTriggered) {
    return new RestartResult(service, true, reason, escalationTriggered);
  }

  static RestartResult refused(Service service, String reason) {
    return new RestartResult(service, false, reason, false);
  }
}
