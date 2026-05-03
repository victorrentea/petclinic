package ro.victorrentea.petclinic.db;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.nio.file.Files;
import java.nio.file.Path;

public class PostgresLauncher {

    static final String DB_USER = "petclinic";
    static final String DB_PASSWORD = "petclinic";
    static final String DB_NAME = "petclinic";

    public static void main(String[] args) throws Exception {
        Path dataDir = Path.of("data").toAbsolutePath();
        Path marker  = Path.of(".bootstrapped").toAbsolutePath();

        EmbeddedPostgres pg = EmbeddedPostgres.builder()
                .setPort(5432)
                .setDataDirectory(dataDir)
                .setCleanDataDirectory(false)
                .start();

        if (!Files.exists(marker)) {
            bootstrap(pg);
            Files.writeString(marker, "ok\n");
            System.out.println("Bootstrap complete: created role + database '" + DB_NAME + "'");
        }

        System.out.println("Postgres started:");
        System.out.println("  JDBC URL: jdbc:postgresql://localhost:" + pg.getPort()
                + "/" + DB_NAME + " (user: " + DB_USER + ", password: " + DB_PASSWORD + ")");
        System.out.println("  Data dir: " + dataDir);
        System.out.println("Press Ctrl+C to stop.");

        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            try { pg.close(); } catch (Exception ignored) {}
        }));

        Thread.currentThread().join();
    }

    public static void bootstrap(EmbeddedPostgres pg) throws Exception {
        DataSource superuser = pg.getPostgresDatabase();
        try (Connection c = superuser.getConnection();
             Statement s = c.createStatement()) {

            if (!roleExists(c, DB_USER)) {
                s.executeUpdate("CREATE USER " + DB_USER + " WITH PASSWORD '" + DB_PASSWORD + "'");
            }
            if (!databaseExists(c, DB_NAME)) {
                s.executeUpdate("CREATE DATABASE " + DB_NAME + " OWNER " + DB_USER);
                s.executeUpdate("GRANT ALL PRIVILEGES ON DATABASE " + DB_NAME + " TO " + DB_USER);
            }
        }
    }

    private static boolean roleExists(Connection c, String name) throws Exception {
        try (Statement s = c.createStatement();
             ResultSet rs = s.executeQuery("SELECT 1 FROM pg_roles WHERE rolname = '" + name + "'")) {
            return rs.next();
        }
    }

    private static boolean databaseExists(Connection c, String name) throws Exception {
        try (Statement s = c.createStatement();
             ResultSet rs = s.executeQuery("SELECT 1 FROM pg_database WHERE datname = '" + name + "'")) {
            return rs.next();
        }
    }
}
