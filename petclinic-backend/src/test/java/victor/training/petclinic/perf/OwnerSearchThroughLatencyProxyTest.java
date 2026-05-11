package victor.training.petclinic.perf;

import com.github.noconnor.junitperf.JUnitPerfInterceptor;
import com.github.noconnor.junitperf.JUnitPerfTest;
import com.github.noconnor.junitperf.JUnitPerfTestRequirement;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Boots the app against the local dev Postgres reached through {@link NetworkLatencyProxy}.
 *  Skipped on machines without a Postgres on localhost:5432 (e.g. CI). */
@SpringBootTest
@AutoConfigureMockMvc
@ExtendWith(JUnitPerfInterceptor.class)
@EnabledIf("devPostgresReachable")
class OwnerSearchThroughLatencyProxyTest {
  private static final int PROXY_PORT = 15432;

  @SuppressWarnings("unused")
  static boolean devPostgresReachable() {
    try (var s = new java.net.Socket("localhost", 5432)) {
      return true;
    } catch (java.io.IOException e) {
      return false;
    }
  }

  @DynamicPropertySource
  static void datasource(DynamicPropertyRegistry r) throws java.io.IOException {
    new NetworkLatencyProxy("localhost", 5432, PROXY_PORT, 2).start();
    r.add("spring.datasource.url", () -> "jdbc:postgresql://localhost:" + PROXY_PORT + "/petclinic");
  }

  @Autowired MockMvc mockMvc;

  @Test
  @JUnitPerfTest(threads = 4, durationMs = 5_000, warmUpMs = 1_000)
  @JUnitPerfTestRequirement(percentiles = "95:200,99:500", executionsPerSec = 20)
  void ownerSearchThroughProxy() throws Exception {
    mockMvc.perform(get("/api/owners"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(10))));
  }
}
