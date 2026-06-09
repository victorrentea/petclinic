package victor.training.petclinic.chatbot;

/**
 * Minimal per-request security context: the authenticated owner's email, parsed from the Bearer
 * JWT the web page sends. Set on the worker thread that runs the (blocking) ChatClient pipeline so
 * the local tools can read it — a stand-in for Spring Security's SecurityContextHolder.
 */
final class OwnerContext {
  private static final ThreadLocal<String> EMAIL = new ThreadLocal<>();

  static void setEmail(String email) {
    EMAIL.set(email);
  }

  static String email() {
    return EMAIL.get();
  }

  static void clear() {
    EMAIL.remove();
  }

  private OwnerContext() {
  }
}
