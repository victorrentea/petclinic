package victor.training.petclinic.chatbot.firefighter;

import java.io.File;
import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.concurrent.TimeUnit;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * The REAL OS exec behind {@link ProcessControl} — the only place that actually kills and launches
 * processes. It is NEVER exercised under test: every test injects a stub instead (see
 * {@code FirefighterGuardTest.RecordingProcessControl} / the agent tests). The guard in
 * {@link FirefighterGuard} decides whether this runs; here we only do the shelling-out.
 *
 * <ul>
 *   <li>{@link #kill(int)}: {@code lsof -ti tcp:<port>} → the PID(s), then {@code kill -9}.</li>
 *   <li>{@link #start(String)}: {@code nohup <script> &} from the repo root, fully detached
 *       (stdout/stderr redirected, stdin from /dev/null) so it outlives this request/JVM.</li>
 * </ul>
 *
 * <p>The scripts live at the repo root, one level above this module; {@code firefighter.repo-root}
 * defaults to {@code ..} (resolved against the working dir) and can be overridden.
 */
@Slf4j
@Component
public class RealProcessControl implements ProcessControl {

  private final Path repoRoot;

  public RealProcessControl(@Value("${firefighter.repo-root:..}") String repoRoot) {
    this.repoRoot = Paths.get(repoRoot).toAbsolutePath().normalize();
  }

  @Override
  public boolean kill(int port) {
    try {
      // Resolve PID(s) on the port. lsof prints one PID per line; empty output -> port already free.
      Process lsof = new ProcessBuilder("lsof", "-ti", "tcp:" + port)
          .redirectErrorStream(true)
          .start();
      String pids = new String(lsof.getInputStream().readAllBytes()).trim();
      lsof.waitFor(5, TimeUnit.SECONDS);
      if (pids.isEmpty()) {
        log.info("🚒 nothing listening on :{} — nothing to kill", port);
        return false;
      }
      for (String pid : pids.split("\\s+")) {
        log.warn("🚒 kill -9 {} (was on :{})", pid, port);
        new ProcessBuilder("kill", "-9", pid).start().waitFor(5, TimeUnit.SECONDS);
      }
      return true;
    } catch (IOException e) {
      log.error("🚒 failed to kill process on :{}", port, e);
      return false;
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      return false;
    }
  }

  @Override
  public void start(String script) {
    try {
      File root = repoRoot.toFile();
      // nohup … & detached: ignore stdin, redirect stdout/stderr to a log, survive JVM exit.
      File logFile = new File(root, "firefighter-" + sanitize(script) + ".log");
      log.warn("🚒 launching {} detached (cwd={}, log={})", script, root, logFile);
      new ProcessBuilder("nohup", "bash", script)
          .directory(root)
          .redirectOutput(ProcessBuilder.Redirect.appendTo(logFile))
          .redirectError(ProcessBuilder.Redirect.appendTo(logFile))
          .redirectInput(new File("/dev/null"))
          .start();
      // We intentionally do NOT wait — the script is long-running and must keep running detached.
    } catch (IOException e) {
      log.error("🚒 failed to launch {}", script, e);
    }
  }

  private String sanitize(String script) {
    return script.replaceAll("[^a-zA-Z0-9._-]", "_");
  }
}
