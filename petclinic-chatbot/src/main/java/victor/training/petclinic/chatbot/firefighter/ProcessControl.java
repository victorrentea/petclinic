package victor.training.petclinic.chatbot.firefighter;

/**
 * The single seam that actually touches the OS — kept tiny and injectable so EVERY test can stub it
 * (no real process is ever killed or launched under test). The production implementation
 * ({@link RealProcessControl}) shells out: {@code kill -9} the PID on a port, then {@code nohup … &}
 * the start-*.sh script detached. The guardrails in {@link FirefighterGuard} decide WHETHER to call
 * this; this interface only decides HOW.
 */
public interface ProcessControl {

  /**
   * Force-kill whatever process is listening on {@code port}.
   *
   * @return true if a process was found and killed, false if the port was already free.
   */
  boolean kill(int port);

  /**
   * Launch a start-*.sh {@code script} (relative to the repo root) in the background, detached,
   * so it outlives this request.
   */
  void start(String script);
}
