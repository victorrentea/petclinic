package victor.training.petclinic.chatbot;

/**
 * Bridges the current user's raw Bearer JWT to the MCP client's {@code customizeRequest}, which runs
 * on {@code java.net.http.HttpClient}'s own executor thread — NOT the request thread — so a per-thread
 * ThreadLocal can't reach it. A single {@code volatile} slot is cross-thread visible: {@link Assistant}
 * sets it for the duration of the (blocking, single-threaded) chat turn and clears it after.
 *
 * <p>One active turn at a time — correct for this demo (and the sequential e2e). True concurrent
 * multiplexing would instead build a per-request MCP client with the token captured in the customizer.
 */
final class BearerTokenContext {
  private static volatile String token;

  static void set(String value) {
    token = value;
  }

  static String get() {
    return token;
  }

  static void clear() {
    token = null;
  }

  private BearerTokenContext() {
  }
}
