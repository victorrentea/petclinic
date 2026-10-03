package victor.training.petclinic.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import java.util.stream.Collectors;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;

class OwnerListIndexesMigrationTest {

    @Test
    void freshDatabaseGetsTheOwnerListIndexes() throws Exception {
        try (EmbeddedPostgres pg = EmbeddedPostgres.builder().start()) {
            DataSource db = pg.getPostgresDatabase();

            flyway(db, null).migrate();

            assertOwnerListIndexes(db);
        }
    }

    @Test
    void databaseAtV3IsUpgradedWithItsSeedRowsIntact() throws Exception {
        try (EmbeddedPostgres pg = EmbeddedPostgres.builder().start()) {
            DataSource db = pg.getPostgresDatabase();
            flyway(db, "3").migrate();
            Integer ownersAtV3 = new JdbcTemplate(db).queryForObject("SELECT count(*) FROM owners", Integer.class);

            var result = flyway(db, null).migrate();

            assertThat(result.migrations).extracting(m -> m.version).containsExactly("4");
            assertOwnerListIndexes(db);
            assertThat(new JdbcTemplate(db).queryForObject("SELECT count(*) FROM owners", Integer.class))
                    .isEqualTo(ownersAtV3)
                    .isPositive();
        }
    }

    private static Flyway flyway(DataSource db, String target) {
        var config = Flyway.configure()
                .dataSource(db)
                .locations("classpath:db/migration", "classpath:db/seed");
        if (target != null) {
            config.target(target);
        }
        return config.load();
    }

    private static void assertOwnerListIndexes(DataSource db) {
        Map<String, String> definitions = new JdbcTemplate(db)
                .queryForList("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'owners'")
                .stream()
                .collect(Collectors.toMap(row -> (String) row.get("indexname"), row -> (String) row.get("indexdef")));

        assertThat(definitions)
                .hasEntrySatisfying("owners_last_name_prefix_idx",
                        def -> assertThat(def).contains("(last_name text_pattern_ops)"))
                .hasEntrySatisfying("owners_name_order_idx",
                        def -> assertThat(def).contains("(last_name, first_name, id)"))
                .hasEntrySatisfying("owners_city_order_idx",
                        def -> assertThat(def).contains("(city, last_name, first_name, id)"));
    }
}
