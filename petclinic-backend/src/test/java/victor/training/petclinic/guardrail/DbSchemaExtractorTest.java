package victor.training.petclinic.guardrail;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

import javax.sql.DataSource;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.Statement;
import java.util.List;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

class DbSchemaExtractorTest {

    @Test
    void generatesDbSqlFromMigrations() throws Exception {
        String pgDump = locatePgDump();
        assumeTrue(pgDump != null, "pg_dump not on PATH or known locations");

        try (EmbeddedPostgres pg = EmbeddedPostgres.builder().start()) {
            DataSource superuser = pg.getPostgresDatabase();
            try (Connection c = superuser.getConnection(); Statement s = c.createStatement()) {
                s.executeUpdate("CREATE USER petclinic WITH PASSWORD 'petclinic'");
                s.executeUpdate("CREATE DATABASE petclinic OWNER petclinic");
            }

            String jdbc = "jdbc:postgresql://localhost:" + pg.getPort() + "/petclinic";
            Flyway.configure()
                    .dataSource(jdbc, "petclinic", "petclinic")
                    .locations("classpath:db/migration")
                    .load()
                    .migrate();

            Path output = projectRoot().resolve("db.sql");
            ProcessBuilder pb = new ProcessBuilder(pgDump,
                    "-h", "localhost",
                    "-p", String.valueOf(pg.getPort()),
                    "-U", "petclinic",
                    "-d", "petclinic",
                    "--schema-only", "--no-owner", "--no-acl", "--no-comments")
                    .redirectErrorStream(true)
                    .redirectOutput(output.toFile());
            pb.environment().put("PGPASSWORD", "petclinic");
            int exit = pb.start().waitFor();
            assertThat(exit).as("pg_dump exit").isZero();

            String dump = Files.readString(output, StandardCharsets.UTF_8);
            String cleaned = stripNoise(dump);
            Files.writeString(output, cleaned, StandardCharsets.UTF_8);

            assertThat(cleaned)
                    .contains("CREATE TABLE")
                    .containsIgnoringCase("owners")
                    .containsIgnoringCase("pets")
                    .containsIgnoringCase("vets");
        }
    }

    private static String stripNoise(String dump) {
        String filtered = dump.lines()
                .filter(line -> !line.startsWith("SET "))
                .filter(line -> !line.startsWith("SELECT pg_catalog.set_config"))
                .filter(line -> !line.startsWith("--"))
                .filter(line -> !line.startsWith("\\restrict"))
                .filter(line -> !line.startsWith("\\unrestrict"))
                .collect(Collectors.joining("\n"));
        return filtered.replaceAll("(?m)(^[ \\t]*\\n){2,}", "\n").strip() + "\n";
    }

    private static Path projectRoot() {
        Path cur = Path.of("").toAbsolutePath();
        while (cur != null && !Files.exists(cur.resolve(".git"))) {
            cur = cur.getParent();
        }
        if (cur == null) throw new IllegalStateException("project root (.git) not found");
        return cur;
    }

    private static String locatePgDump() {
        try {
            Process p = new ProcessBuilder("pg_dump", "--version").redirectErrorStream(true).start();
            if (p.waitFor() == 0) return "pg_dump";
        } catch (Exception ignored) {
        }
        for (String c : List.of(
                "/opt/homebrew/Cellar/libpq/17.5/bin/pg_dump",
                "/opt/homebrew/opt/libpq/bin/pg_dump",
                "/usr/local/opt/libpq/bin/pg_dump",
                "/usr/bin/pg_dump")) {
            if (Files.exists(Path.of(c))) return c;
        }
        return null;
    }
}
