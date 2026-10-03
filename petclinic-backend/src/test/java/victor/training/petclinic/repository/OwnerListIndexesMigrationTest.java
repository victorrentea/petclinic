package victor.training.petclinic.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
class OwnerListIndexesMigrationTest {
    private static final String UPGRADED_SCHEMA = "upgraded_from_v3";

    @Autowired
    DataSource dataSource;
    @Autowired
    JdbcTemplate jdbc;

    // Shared with every other test of this Spring context, e.g. the pg_dump of DbSchemaExtractorTest
    @AfterEach
    void dropUpgradedSchema() {
        jdbc.execute("DROP SCHEMA IF EXISTS " + UPGRADED_SCHEMA + " CASCADE");
    }

    @Test
    void freshDatabase_hasTheOwnerListIndexes() {
        assertOwnerListIndexesIn("public");
    }

    @Test
    void databaseAlreadyAtV3_upgradesToTheOwnerListIndexes() {
        Flyway atV3 = Flyway.configure().dataSource(dataSource).schemas(UPGRADED_SCHEMA)
                .locations("classpath:db/migration").target("3").load();
        atV3.migrate();
        assertThat(ownerIndexDefinitions(UPGRADED_SCHEMA)).noneMatch(index -> index.contains("last_name"));

        Flyway.configure().dataSource(dataSource).schemas(UPGRADED_SCHEMA)
                .locations("classpath:db/migration").load().migrate();

        assertOwnerListIndexesIn(UPGRADED_SCHEMA);
    }

    private void assertOwnerListIndexesIn(String schema) {
        assertThat(ownerIndexDefinitions(schema))
                .anyMatch(index -> index.contains("owners_last_name_pattern_idx")
                        && index.contains("(last_name text_pattern_ops)"))
                .anyMatch(index -> index.contains("owners_name_order_idx")
                        && index.contains("(last_name, first_name, id)"))
                .anyMatch(index -> index.contains("owners_city_order_idx")
                        && index.contains("(city, last_name, first_name, id)"));
    }

    private List<String> ownerIndexDefinitions(String schema) {
        return jdbc.queryForList(
                "SELECT indexdef FROM pg_indexes WHERE schemaname = ? AND tablename = 'owners'",
                String.class, schema);
    }
}
