package victor.training.petclinic.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import java.util.stream.Collectors;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;

/** V4 must apply both to a fresh database and to one already holding owners at V3. */
class OwnerListIndexesMigrationTest {

    @Test
    void freshDatabase_getsTheOwnerListIndexes() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            migrate(dataSource, "latest");

            assertOwnerListIndexes(new JdbcTemplate(dataSource));
        }
    }

    @Test
    void existingV3DatabaseWithOwners_isUpgraded() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            migrate(dataSource, "3");
            JdbcTemplate jdbc = new JdbcTemplate(dataSource);
            jdbc.update("INSERT INTO owners (first_name, last_name, address, city, telephone)"
                    + " VALUES ('Harry', 'Potter', '4 Privet Drive', 'Little Whinging', '0123456789')");

            migrate(dataSource, "latest");

            assertOwnerListIndexes(jdbc);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM owners", Long.class)).isEqualTo(1);
        }
    }

    private static void migrate(DataSource dataSource, String target) {
        Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").target(target)
                .load().migrate();
    }

    private static void assertOwnerListIndexes(JdbcTemplate jdbc) {
        Map<String, String> indexes = jdbc.queryForList(
                "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'owners'").stream()
                .collect(Collectors.toMap(row -> (String) row.get("indexname"), row -> (String) row.get("indexdef")));

        assertThat(indexes.get("owners_last_name_prefix_idx")).contains("(last_name text_pattern_ops)");
        assertThat(indexes.get("owners_name_order_idx")).contains("(last_name, first_name, id)");
        assertThat(indexes.get("owners_city_order_idx")).contains("(city, last_name, first_name, id)");
    }
}
