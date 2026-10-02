package victor.training.petclinic.rest;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
class OwnerListIndexesTest {
    @Autowired
    JdbcTemplate jdbc;
    @Autowired
    DataSource dataSource;

    @Test
    void freshDatabaseContainsOwnerListIndexes() {
        assertIndexes("public");
    }

    @Test
    void upgradesVersionThreeWithoutChangingExistingData() {
        Flyway.configure().dataSource(dataSource).locations("classpath:db/migration")
                .schemas("owner_index_upgrade").target("3").load().migrate();
        jdbc.update("""
                INSERT INTO owner_index_upgrade.owners(first_name, last_name, city)
                VALUES ('Alice', 'Adams', 'London')
                """);
        Flyway.configure().dataSource(dataSource).locations("classpath:db/migration")
                .schemas("owner_index_upgrade").load().migrate();
        assertIndexes("owner_index_upgrade");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM owner_index_upgrade.owners", Long.class))
                .isEqualTo(1);
    }

    private void assertIndexes(String schema) {
        List<String> indexes = jdbc.queryForList("""
                SELECT indexdef FROM pg_indexes WHERE schemaname = ? AND tablename = 'owners'
                """, String.class, schema);
        assertThat(indexes).anySatisfy(index -> assertThat(index).contains("(last_name text_pattern_ops)"));
        assertThat(indexes).anySatisfy(index -> assertThat(index).contains("(last_name, first_name, id)"));
        assertThat(indexes).anySatisfy(index -> assertThat(index).contains("(city, last_name, first_name, id)"));
    }
}
