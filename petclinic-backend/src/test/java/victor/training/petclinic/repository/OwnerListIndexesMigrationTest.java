package victor.training.petclinic.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import java.util.List;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
class OwnerListIndexesMigrationTest {
    private static final List<String> OWNER_LIST_INDEXES = List.of(
            "owners_last_name_pattern_idx", "owners_name_order_idx", "owners_city_order_idx");
    private static final String[] LOCATIONS = {"classpath:db/migration", "classpath:db/seed"};

    @Autowired
    DataSource dataSource;

    @Test
    void freshDatabase_hasTheOwnerListIndexes() {
        assertThat(ownerIndexDefinitions("public"))
                .anyMatch(def -> def.contains("owners_last_name_pattern_idx") && def.contains("text_pattern_ops"))
                .anyMatch(def -> def.contains("owners_name_order_idx") && def.contains("(last_name, first_name, id)"))
                .anyMatch(def -> def.contains("owners_city_order_idx")
                        && def.contains("(city, last_name, first_name, id)"));
    }

    @Test
    void databaseAtV3_upgradesWithItsRowsAndGainsTheIndexes() {
        String schema = "upgraded_from_v3";
        Flyway.configure().dataSource(dataSource).schemas(schema).locations(LOCATIONS).target("3")
                .load().migrate();
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        Integer ownersAtV3 = jdbc.queryForObject("SELECT count(*) FROM " + schema + ".owners", Integer.class);

        Flyway.configure().dataSource(dataSource).schemas(schema).locations(LOCATIONS).load().migrate();

        assertThat(String.join("\n", ownerIndexDefinitions(schema))).contains(OWNER_LIST_INDEXES);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM " + schema + ".owners", Integer.class))
                .isPositive()
                .isEqualTo(ownersAtV3);
    }

    // A rollback redeploys the previous application onto the indexed schema: its Flyway knows
    // only V1..V3 and must accept the applied V4 as a future migration, not refuse to boot.
    @Test
    void applicationBeforeV4_stillBootsOnTheIndexedSchema(@TempDir Path previousRelease) throws IOException {
        String schema = "rolled_back";
        Flyway.configure().dataSource(dataSource).schemas(schema).locations(LOCATIONS).load().migrate();
        for (String version : List.of("V1__core_owners_pets.sql", "V2__add_vets_and_security.sql",
                "V3__visit_and_specialty_details.sql")) {
            Files.copy(new ClassPathResource("db/migration/" + version).getInputStream(),
                    previousRelease.resolve(version));
        }
        Files.copy(new ClassPathResource("db/seed/R__seed.sql").getInputStream(),
                previousRelease.resolve("R__seed.sql"));

        Flyway previousApplication = Flyway.configure().dataSource(dataSource).schemas(schema)
                .locations("filesystem:" + previousRelease).load();

        assertThatCode(previousApplication::validate).doesNotThrowAnyException();
        assertThat(previousApplication.migrate().migrationsExecuted).isZero();
    }

    private List<String> ownerIndexDefinitions(String schema) {
        return new JdbcTemplate(dataSource).queryForList(
                "SELECT indexdef FROM pg_indexes WHERE schemaname = ? AND tablename = 'owners'",
                String.class, schema);
    }
}
