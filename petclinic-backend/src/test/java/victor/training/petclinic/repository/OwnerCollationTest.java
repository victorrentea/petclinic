package victor.training.petclinic.repository;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

/** Owners sort in Romanian alphabetical order on any OS the database runs on (#25). */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
class OwnerCollationTest {
    @Autowired
    JdbcTemplate jdbc;

    @Test
    void sCommaComesAfterEverySWord() {
        for (String lastName : new String[]{"Tudor", "Șerban", "Szabo", "Sava"}) {
            jdbc.update("INSERT INTO owners (first_name, last_name, city) VALUES ('Ion', ?, ?)", lastName, lastName);
        }

        assertThat(jdbc.queryForList("SELECT last_name FROM owners ORDER BY last_name", String.class))
                .containsExactly("Sava", "Szabo", "Șerban", "Tudor");
        assertThat(jdbc.queryForList("SELECT city FROM owners ORDER BY city", String.class))
                .containsExactly("Sava", "Szabo", "Șerban", "Tudor");
    }
}
