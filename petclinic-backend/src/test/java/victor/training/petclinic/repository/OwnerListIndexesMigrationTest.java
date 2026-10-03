package victor.training.petclinic.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import javax.sql.DataSource;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
class OwnerListIndexesMigrationTest {
    private static final List<String> OWNER_LIST_INDEXES = List.of(
            "owners_last_name_pattern_idx", "owners_name_order_idx", "owners_city_order_idx");
    private static final String UPGRADED_SCHEMA = "upgraded_from_v3";

    @Autowired
    JdbcTemplate jdbc;
    @Autowired
    DataSource dataSource;

    @Test
    void aFreshDatabase_hasTheOwnerListIndexes() {
        assertThat(ownerIndexes("public")).containsAll(OWNER_LIST_INDEXES);
    }

    @Test
    void aDatabaseAtV3_gainsTheOwnerListIndexesOnUpgrade() {
        try {
            flyway("3").migrate();
            assertThat(ownerIndexes(UPGRADED_SCHEMA)).doesNotContainAnyElementsOf(OWNER_LIST_INDEXES);

            flyway("latest").migrate();

            assertThat(ownerIndexes(UPGRADED_SCHEMA)).containsAll(OWNER_LIST_INDEXES);
        } finally {
            jdbc.execute("DROP SCHEMA IF EXISTS " + UPGRADED_SCHEMA + " CASCADE");
        }
    }

    private Flyway flyway(String target) {
        return Flyway.configure()
                .dataSource(dataSource)
                .schemas(UPGRADED_SCHEMA)
                .locations("classpath:db/migration", "classpath:db/seed")
                .target(target)
                .load();
    }

    private List<String> ownerIndexes(String schema) {
        return jdbc.queryForList("SELECT indexname FROM pg_indexes WHERE schemaname = ? AND tablename = 'owners'",
                String.class, schema);
    }
}
