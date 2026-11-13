package victor.training.petclinic.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.stream.LongStream;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;

/** The `large` profile's dataset boots, and a page of it is still answered in milliseconds. */
// The locations are spelled out: the tests' config/application.properties outranks a profile file
@SpringBootTest(properties = "spring.flyway.locations="
        + "classpath:db/migration,classpath:db/reference,classpath:db/seed,classpath:db/seed-large")
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
class LargeOwnerDatasetTest {
    @Autowired
    JdbcTemplate jdbc;
    @Autowired
    MockMvc mockMvc;

    @Test
    void fiftyThousandOwnersOnTopOfTheDefaultSeed() {
        assertThat(jdbc.queryForObject("SELECT count(*) FROM owners", Long.class)).isGreaterThan(50_000);
        assertThat(jdbc.queryForObject("SELECT last_name FROM owners WHERE id = 1", String.class))
                .as("the Default seed is still there").isEqualTo("McCallister");
    }

    @Test
    void aPageByNameAnswersInUnder100ms() throws Exception {
        long fastestMs = LongStream.range(0, 5)
                .map(i -> timeMs("/api/owners?sort=name,asc&size=20"))
                .min().orElseThrow();

        assertThat(fastestMs).isLessThan(100);
    }

    private long timeMs(String uri) {
        try {
            long start = System.nanoTime();
            mockMvc.perform(get(uri)).andExpect(status().isOk());
            return (System.nanoTime() - start) / 1_000_000;
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
