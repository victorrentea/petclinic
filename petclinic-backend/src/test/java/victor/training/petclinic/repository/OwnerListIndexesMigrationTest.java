package victor.training.petclinic.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;

class OwnerListIndexesMigrationTest {
    private static final List<String> OWNER_LIST_INDEXES = List.of(
            "owners_city_order_idx", "owners_last_name_pattern_idx", "owners_name_order_idx");

    @Test
    void freshDatabase_getsTheOwnerListIndexes() throws Exception {
        try (EmbeddedPostgres pg = EmbeddedPostgres.builder().start()) {
            flyway(pg.getPostgresDatabase(), null).migrate();

            assertThat(ownerListIndexes(pg.getPostgresDatabase())).containsExactlyElementsOf(OWNER_LIST_INDEXES);
        }
    }

    @Test
    void databaseAtV3_upgradesWithItsRowsIntact() throws Exception {
        try (EmbeddedPostgres pg = EmbeddedPostgres.builder().start()) {
            DataSource db = pg.getPostgresDatabase();
            flyway(db, "3").migrate();
            assertThat(ownerListIndexes(db)).isEmpty();
            Integer ownersAtV3 = new JdbcTemplate(db).queryForObject("SELECT count(*) FROM owners", Integer.class);

            flyway(db, null).migrate();

            assertThat(ownerListIndexes(db)).containsExactlyElementsOf(OWNER_LIST_INDEXES);
            assertThat(new JdbcTemplate(db).queryForObject("SELECT count(*) FROM owners", Integer.class))
                    .isEqualTo(ownersAtV3);
            assertThat(new JdbcTemplate(db).queryForObject(
                    "SELECT indexdef FROM pg_indexes WHERE indexname = 'owners_last_name_pattern_idx'", String.class))
                    .contains("text_pattern_ops");
        }
    }

    // Rollback safety: the application from before V4 keeps booting once V4 has run, and leaves the indexes alone
    @Test
    void applicationFromBeforeV4_stillValidatesAndMigrates(@TempDir Path oldRelease) throws Exception {
        for (String script : List.of("migration/V1__core_owners_pets.sql", "migration/V2__add_vets_and_security.sql",
                "migration/V3__visit_and_specialty_details.sql", "seed/R__seed.sql")) {
            Path copy = oldRelease.resolve(script);
            Files.createDirectories(copy.getParent());
            try (var in = getClass().getResourceAsStream("/db/" + script)) {
                Files.copy(in, copy);
            }
        }
        try (EmbeddedPostgres pg = EmbeddedPostgres.builder().start()) {
            DataSource db = pg.getPostgresDatabase();
            flyway(db, null).migrate();

            Flyway oldApp = Flyway.configure().dataSource(db)
                    .locations("filesystem:" + oldRelease.resolve("migration"),
                            "filesystem:" + oldRelease.resolve("seed"))
                    .load();
            oldApp.validate();
            assertThat(oldApp.migrate().migrationsExecuted).isZero();
            assertThat(ownerListIndexes(db)).containsExactlyElementsOf(OWNER_LIST_INDEXES);
        }
    }

    private static Flyway flyway(DataSource db, String target) {
        var config = Flyway.configure().dataSource(db).locations("classpath:db/migration", "classpath:db/seed");
        return (target == null ? config : config.target(target)).load();
    }

    private static List<String> ownerListIndexes(DataSource db) {
        return new JdbcTemplate(db).queryForList("""
                SELECT indexname FROM pg_indexes
                WHERE tablename = 'owners' AND indexname <> 'owners_pkey'
                ORDER BY indexname""", String.class);
    }
}
