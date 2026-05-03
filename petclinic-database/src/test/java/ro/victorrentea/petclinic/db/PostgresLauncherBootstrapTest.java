package ro.victorrentea.petclinic.db;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PostgresLauncherBootstrapTest {

    @Test
    void bootstrap_creates_petclinic_role_and_database() throws Exception {
        try (EmbeddedPostgres pg = EmbeddedPostgres.builder().start()) {
            PostgresLauncher.bootstrap(pg);

            String url = "jdbc:postgresql://localhost:" + pg.getPort() + "/petclinic";
            try (Connection c = DriverManager.getConnection(url, "petclinic", "petclinic");
                 Statement s = c.createStatement();
                 ResultSet rs = s.executeQuery("SELECT current_user, current_database()")) {
                assertTrue(rs.next());
                assertEquals("petclinic", rs.getString(1));
                assertEquals("petclinic", rs.getString(2));
            }
        }
    }
}
