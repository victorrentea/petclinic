package victor.training.petclinic.perf;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.persistence.EntityManagerFactory;

/**
 * Opt-in scale regression for the owners list: {@code mvn test -Dtest=OwnerListScaleTest -Downers.scale=true}.
 * Runs on a disposable embedded Postgres holding the 100,000 owners the clinic expects within a year, each
 * with pets and visits, and never touches the running dev database. Timings are printed, not asserted:
 * no latency target has been agreed.
 */
@EnabledIfSystemProperty(named = "owners.scale", matches = "true")
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
class OwnerListScaleTest {
    private static final int OWNERS = 100_000;
    private static final int SIZE = 20;
    private static final int LAST_PAGE = OWNERS / SIZE - 1;

    @Autowired
    MockMvc mockMvc;
    @Autowired
    ObjectMapper mapper;
    @Autowired
    JdbcTemplate jdbc;
    @Autowired
    EntityManagerFactory entityManagerFactory;

    @Test
    void firstDeepAndFinalPagesStayBoundedAndExact() throws Exception {
        seedRegister();
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();

        JsonNode first = timed("first page", statistics, "page=0&size=20");
        JsonNode deep = timed("deep page", statistics, "page=2500&size=20&sort=city,desc");
        JsonNode last = timed("final page", statistics, "page=" + LAST_PAGE + "&size=20");
        JsonNode beyond = timed("page beyond the end", statistics, "page=" + (LAST_PAGE + 1) + "&size=20");

        assertThat(first.get("totalElements").asLong()).isEqualTo(OWNERS);
        assertThat(first.get("totalPages").asInt()).isEqualTo(OWNERS / SIZE);
        assertThat(first.get("content")).hasSize(SIZE);
        assertThat(deep.get("content")).hasSize(SIZE);
        assertThat(last.get("content")).hasSize(SIZE);
        assertThat(beyond.get("content")).isEmpty();
        assertThat(beyond.get("totalElements").asLong()).isEqualTo(OWNERS);
    }

    @Test
    void filteredResultsAreGloballySortedAndExactlyCounted() throws Exception {
        seedRegister();
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        long expected = jdbc.queryForObject("SELECT count(*) FROM owners WHERE last_name LIKE 'Last0042%'",
                Long.class);
        String maxMatching = jdbc.queryForObject("SELECT max(last_name) FROM owners WHERE last_name LIKE 'Last0042%'",
                String.class);

        JsonNode page = timed("filtered, descending", statistics, "lastName=Last0042&sort=lastName,desc&size=20");

        assertThat(expected).isGreaterThan(SIZE);
        assertThat(page.get("totalElements").asLong()).isEqualTo(expected);
        assertThat(page.get("content").get(0).get("lastName").asText()).isEqualTo(maxMatching);
        List<String> lastNames = page.get("content").findValuesAsText("lastName");
        assertThat(lastNames).isSortedAccordingTo((a, b) -> b.compareTo(a));
    }

    private JsonNode timed(String label, Statistics statistics, String query) throws Exception {
        statistics.clear();
        long started = System.nanoTime();
        String json = mockMvc.perform(get("/api/owners?" + query))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        long millis = (System.nanoTime() - started) / 1_000_000;
        long selects = statistics.getPrepareStatementCount();
        System.out.printf("OWNER-LIST-SCALE %-22s %5d ms, %d SELECTs%n", label, millis, selects);
        assertThat(selects).as("%s: SELECT statements", label).isLessThanOrEqualTo(3);
        return mapper.readTree(json);
    }

    /** 100,000 owners, 1.5 pets each, 2 visits per pet: written in SQL, in seconds. */
    private void seedRegister() {
        jdbc.execute("""
                INSERT INTO owners (first_name, last_name, address, city, telephone)
                SELECT 'First' || g,
                        'Last' || lpad(((g * 7919) %% %d)::text, 6, '0'),
                        g || ' Some Street',
                        'City' || (g %% 997),
                        lpad((g %% 10000000000)::text, 10, '0')
                FROM generate_series(1, %d) g""".formatted(OWNERS, OWNERS));
        jdbc.execute("""
                INSERT INTO pets (name, birth_date, type_id, owner_id)
                SELECT 'Pet' || o.id || '-' || n, DATE '2020-01-01', 1 + (o.id %% 7), o.id
                FROM owners o, generate_series(1, 2) n
                WHERE n = 1 OR o.id %% 2 = 0""".replace("%%", "%"));
        jdbc.execute("""
                INSERT INTO visits (pet_id, visit_date, description)
                SELECT p.id, DATE '2024-01-01' + v, 'visit ' || v
                FROM pets p, generate_series(1, 2) v""");
        jdbc.execute("ANALYZE");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM owners", Integer.class)).isEqualTo(OWNERS);
    }
}
