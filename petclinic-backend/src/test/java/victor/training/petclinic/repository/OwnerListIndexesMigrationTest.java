package victor.training.petclinic.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
class OwnerListIndexesMigrationTest {
    private static final List<String> OWNER_LIST_INDEXES = List.of(
            "owners_last_name_pattern_idx", "owners_name_order_idx", "owners_city_order_idx");

    @Autowired
    DataSource dataSource;
    @Autowired
    JdbcTemplate jdbc;

    @Test
    void freshDatabase_hasOwnerListIndexes() {
        assertThat(ownerIndexDefinitions("public")).containsExactlyInAnyOrder(
                "CREATE INDEX owners_last_name_pattern_idx ON public.owners USING btree (last_name text_pattern_ops)",
                "CREATE INDEX owners_name_order_idx ON public.owners USING btree (last_name, first_name, id)",
                "CREATE INDEX owners_city_order_idx ON public.owners USING btree (city, last_name, first_name, id)");
    }

    @Test
    void databaseAtV3_upgradesToOwnerListIndexes() {
        String schema = "upgraded_from_v3";
        flyway(schema).target("3").load().migrate();
        assertThat(ownerIndexDefinitions(schema)).isEmpty();

        flyway(schema).load().migrate();

        assertThat(ownerIndexDefinitions(schema)).hasSize(OWNER_LIST_INDEXES.size());
    }

    private org.flywaydb.core.api.configuration.FluentConfiguration flyway(String schema) {
        return Flyway.configure().dataSource(dataSource).schemas(schema).locations("classpath:db/migration");
    }

    private List<String> ownerIndexDefinitions(String schema) {
        return jdbc.queryForList(
                "SELECT indexdef FROM pg_indexes WHERE schemaname = ? AND indexname = ANY (?)",
                String.class, schema, OWNER_LIST_INDEXES.toArray(String[]::new));
    }
}
