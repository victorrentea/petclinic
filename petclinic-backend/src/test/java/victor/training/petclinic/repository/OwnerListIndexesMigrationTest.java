package victor.training.petclinic.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.HashMap;
import java.util.Map;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;

/** V4 applies both to an empty database and on top of a V3 one already holding rows. */
class OwnerListIndexesMigrationTest {

    private static final Map<String, String> EXPECTED = Map.of(
            "owners_last_name_pattern_idx", "(last_name text_pattern_ops)",
            "owners_name_order_idx", "(last_name, first_name, id)",
            "owners_city_order_idx", "(city, last_name, first_name, id)");

    @Test
    void freshDatabase() throws Exception {
        try (EmbeddedPostgres pg = EmbeddedPostgres.builder().start()) {
            DataSource db = pg.getPostgresDatabase();
            flyway(db, "latest").migrate();

            assertIndexes(db);
        }
    }

    @Test
    void existingV3DatabaseWithData() throws Exception {
        try (EmbeddedPostgres pg = EmbeddedPostgres.builder().start()) {
            DataSource db = pg.getPostgresDatabase();
            flyway(db, "3").migrate();
            assertThat(ownerIndexes(db)).containsOnlyKeys("owners_pkey");
            long owners = countOwners(db);
            assertThat(owners).isPositive();

            assertThat(flyway(db, "latest").migrate().migrationsExecuted).isEqualTo(1);

            assertIndexes(db);
            assertThat(countOwners(db)).isEqualTo(owners);
        }
    }

    private static Flyway flyway(DataSource db, String target) {
        return Flyway.configure()
                .dataSource(db)
                .locations("classpath:db/migration", "classpath:db/seed")
                .target(target)
                .load();
    }

    private static void assertIndexes(DataSource db) throws Exception {
        Map<String, String> indexes = ownerIndexes(db);
        EXPECTED.forEach((name, columns) -> assertThat(indexes.get(name)).as(name).endsWith(columns));
    }

    private static Map<String, String> ownerIndexes(DataSource db) throws Exception {
        Map<String, String> indexes = new HashMap<>();
        try (Connection c = db.getConnection();
                Statement s = c.createStatement();
                ResultSet rs = s
                        .executeQuery("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'owners'")) {
            while (rs.next()) {
                indexes.put(rs.getString(1), rs.getString(2));
            }
        }
        return indexes;
    }

    private static long countOwners(DataSource db) throws Exception {
        try (Connection c = db.getConnection();
                Statement s = c.createStatement();
                ResultSet rs = s.executeQuery("SELECT count(*) FROM owners")) {
            rs.next();
            return rs.getLong(1);
        }
    }
}
