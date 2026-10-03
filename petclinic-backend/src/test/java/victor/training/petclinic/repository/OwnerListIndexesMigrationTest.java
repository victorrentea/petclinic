package victor.training.petclinic.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;

/** V4 must apply both to a brand-new database and on top of one already at V3, as production is. */
class OwnerListIndexesMigrationTest {
    private static final List<String> EXPECTED = List.of(
            "CREATE INDEX owners_last_name_pattern_idx ON public.owners USING btree (last_name text_pattern_ops)",
            "CREATE INDEX owners_name_order_idx ON public.owners USING btree (last_name, first_name, id)",
            "CREATE INDEX owners_city_order_idx ON public.owners USING btree (city, last_name, first_name, id)");

    @Test
    void freshDatabase() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.start()) {
            DataSource db = postgres.getPostgresDatabase();
            flyway(db, MigrationVersion.LATEST).migrate();

            assertThat(ownerIndexes(db)).containsExactlyInAnyOrderElementsOf(EXPECTED);
        }
    }

    @Test
    void databaseAlreadyAtV3() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.start()) {
            DataSource db = postgres.getPostgresDatabase();
            flyway(db, MigrationVersion.fromVersion("3")).migrate();
            assertThat(ownerIndexes(db)).isEmpty();

            flyway(db, MigrationVersion.LATEST).migrate();

            assertThat(ownerIndexes(db)).containsExactlyInAnyOrderElementsOf(EXPECTED);
        }
    }

    private static Flyway flyway(DataSource db, MigrationVersion target) {
        return Flyway.configure().dataSource(db).locations("classpath:db/migration", "classpath:db/seed")
                .target(target).load();
    }

    private static List<String> ownerIndexes(DataSource db) {
        return new JdbcTemplate(db).queryForList(
                "SELECT indexdef FROM pg_indexes WHERE tablename = 'owners' AND indexname <> 'owners_pkey'",
                String.class);
    }
}
