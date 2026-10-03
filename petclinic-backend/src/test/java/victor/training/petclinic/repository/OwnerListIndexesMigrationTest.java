package victor.training.petclinic.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;

/** V4 adds the owner-list indexes, whether the database is created from scratch or already sits at V3. */
class OwnerListIndexesMigrationTest {
    private static final List<String> OWNER_LIST_INDEXES = List.of(
            "owners_last_name_pattern_idx", "owners_name_order_idx", "owners_city_order_idx");

    @Test
    void freshDatabase() throws Exception {
        try (EmbeddedPostgres pg = EmbeddedPostgres.builder().start()) {
            DataSource db = pg.getPostgresDatabase();
            flyway(db, null).migrate();

            assertThat(ownerIndexDefinitions(db)).containsOnlyKeys(OWNER_LIST_INDEXES);
        }
    }

    @Test
    void databaseAlreadyAtV3() throws Exception {
        try (EmbeddedPostgres pg = EmbeddedPostgres.builder().start()) {
            DataSource db = pg.getPostgresDatabase();
            flyway(db, "3").migrate();
            new JdbcTemplate(db).update("INSERT INTO owners (first_name, last_name, address, city, telephone)"
                    + " VALUES ('Harry', 'Potter', '4 Privet Drive', 'Little Whinging', '0119084455')");
            assertThat(ownerIndexDefinitions(db)).isEmpty();

            flyway(db, null).migrate();

            var definitions = ownerIndexDefinitions(db);
            assertThat(definitions).containsOnlyKeys(OWNER_LIST_INDEXES);
            assertThat(definitions.get("owners_last_name_pattern_idx")).contains("text_pattern_ops");
            assertThat(definitions.get("owners_name_order_idx")).contains("(last_name, first_name, id)");
            assertThat(definitions.get("owners_city_order_idx")).contains("(city, last_name, first_name, id)");
        }
    }

    private static Flyway flyway(DataSource db, String target) {
        var config = Flyway.configure().dataSource(db).locations("classpath:db/migration");
        return (target == null ? config : config.target(target)).load();
    }

    private static Map<String, String> ownerIndexDefinitions(DataSource db) {
        Map<String, String> definitions = new TreeMap<>();
        new JdbcTemplate(db).queryForList(
                "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'owners' AND indexname <> 'owners_pkey'")
                .forEach(row -> definitions.put((String) row.get("indexname"), (String) row.get("indexdef")));
        return definitions;
    }
}
