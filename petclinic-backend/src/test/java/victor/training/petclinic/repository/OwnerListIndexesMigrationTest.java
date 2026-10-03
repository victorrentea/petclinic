package victor.training.petclinic.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;

class OwnerListIndexesMigrationTest {
    private static final List<String> OWNER_LIST_INDEXES = List.of(
            "CREATE INDEX owners_city_order_idx ON %s.owners USING btree (city, last_name, first_name, id)",
            "CREATE INDEX owners_last_name_pattern_idx ON %s.owners USING btree (last_name text_pattern_ops)",
            "CREATE INDEX owners_name_order_idx ON %s.owners USING btree (last_name, first_name, id)");

    private static EmbeddedPostgres pg;
    private static DataSource dataSource;

    @BeforeAll
    static void startPostgres() throws Exception {
        pg = EmbeddedPostgres.builder().start();
        dataSource = pg.getPostgresDatabase();
    }

    @AfterAll
    static void stopPostgres() throws Exception {
        pg.close();
    }

    @Test
    void freshDatabase_getsTheOwnerListIndexes() {
        migrate("fresh", null);

        assertThat(ownerIndexes("fresh")).containsAll(expected("fresh"));
    }

    @Test
    void seededV3Database_upgradesWithItsRowsIntact() {
        migrate("upgraded", "3");
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        long ownersAtV3 = jdbc.queryForObject("SELECT count(*) FROM upgraded.owners", Long.class);
        assertThat(ownersAtV3).isPositive();
        assertThat(ownerIndexes("upgraded")).doesNotContainAnyElementsOf(expected("upgraded"));

        migrate("upgraded", null);

        assertThat(ownerIndexes("upgraded")).containsAll(expected("upgraded"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM upgraded.owners", Long.class)).isEqualTo(ownersAtV3);
    }

    private static void migrate(String schema, String target) {
        var config = Flyway.configure()
                .dataSource(dataSource)
                .schemas(schema)
                .locations("classpath:db/migration", "classpath:db/seed");
        if (target != null) {
            config.target(target);
        }
        config.load().migrate();
    }

    private static List<String> ownerIndexes(String schema) {
        return new JdbcTemplate(dataSource).queryForList(
                "SELECT indexdef FROM pg_indexes WHERE schemaname = ? AND tablename = 'owners'", String.class, schema);
    }

    private static List<String> expected(String schema) {
        return OWNER_LIST_INDEXES.stream().map(definition -> definition.formatted(schema)).toList();
    }
}
