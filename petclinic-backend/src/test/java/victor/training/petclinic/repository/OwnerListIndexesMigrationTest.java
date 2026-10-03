package victor.training.petclinic.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;

class OwnerListIndexesMigrationTest {
    private static final List<String> OWNER_LIST_INDEXES = List.of(
            "CREATE INDEX owners_city_order_idx ON public.owners USING btree (city, last_name, first_name, id)",
            "CREATE INDEX owners_last_name_pattern_idx ON public.owners USING btree (last_name text_pattern_ops)",
            "CREATE INDEX owners_name_order_idx ON public.owners USING btree (last_name, first_name, id)");

    @Test
    void freshDatabase_getsTheOwnerListIndexes() throws Exception {
        try (EmbeddedPostgres pg = EmbeddedPostgres.builder().start()) {
            DataSource db = pg.getPostgresDatabase();

            flyway(db, MigrationVersion.LATEST).migrate();

            assertThat(ownerIndexes(db)).containsAll(OWNER_LIST_INDEXES);
        }
    }

    @Test
    void databaseAtV3_migratesKeepingItsOwners() throws Exception {
        try (EmbeddedPostgres pg = EmbeddedPostgres.builder().start()) {
            DataSource db = pg.getPostgresDatabase();
            flyway(db, MigrationVersion.fromVersion("3")).migrate();
            new JdbcTemplate(db).update("INSERT INTO owners (first_name, last_name) VALUES ('Kept', 'Owner')");

            flyway(db, MigrationVersion.LATEST).migrate();

            assertThat(ownerIndexes(db)).containsAll(OWNER_LIST_INDEXES);
            assertThat(new JdbcTemplate(db).queryForObject("SELECT count(*) FROM owners", Long.class)).isOne();
        }
    }

    // Rolling the application back must not need a schema rollback: the previous release only
    // knows V1-V3, and Flyway ignores an applied migration newer than its own by default
    @Test
    void previousRelease_stillValidatesADatabaseAtV4(@TempDir Path previousRelease) throws Exception {
        for (String v : List.of("V1__core_owners_pets.sql", "V2__add_vets_and_security.sql",
                "V3__visit_and_specialty_details.sql")) {
            Files.copy(Path.of("src/main/resources/db/migration", v), previousRelease.resolve(v));
        }
        try (EmbeddedPostgres pg = EmbeddedPostgres.builder().start()) {
            DataSource db = pg.getPostgresDatabase();
            flyway(db, MigrationVersion.LATEST).migrate();

            Flyway previous = Flyway.configure().dataSource(db)
                    .locations("filesystem:" + previousRelease).load();

            assertThatCode(previous::validate).doesNotThrowAnyException();
            assertThat(previous.migrate().migrationsExecuted).isZero();
        }
    }

    private static Flyway flyway(DataSource db, MigrationVersion target) {
        return Flyway.configure().dataSource(db).locations("classpath:db/migration").target(target).load();
    }

    private static List<String> ownerIndexes(DataSource db) {
        return new JdbcTemplate(db).queryForList(
                "SELECT indexdef FROM pg_indexes WHERE tablename = 'owners' ORDER BY indexname", String.class);
    }
}
