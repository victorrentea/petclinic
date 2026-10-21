package victor.training.petclinic;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * What a Spring test starts on, pinned down: the schema plus the reference rows when it declares
 * nothing, the Default seed when it says {@link DefaultFixture} — and never what the test before it
 * left behind. Not {@code @Transactional} on purpose: a committed row is the one that could leak.
 */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class StartingDatabaseTest {
    @Autowired
    JdbcTemplate jdbc;

    private int count(String table) {
        return jdbc.queryForObject("SELECT count(*) FROM " + table, Integer.class);
    }

    @Test
    @Order(1)
    void aTestThatDeclaresNothingStartsOnAnEmptyDatabase() {
        for (String table : new String[]{"owners", "pets", "visits", "vets", "vet_specialties", "users", "roles"}) {
            assertThat(count(table)).as(table).isZero();
        }
        assertThat(jdbc.queryForList("SELECT name FROM types ORDER BY id", String.class))
                .as("reference data (db/reference) is there all the same")
                .containsExactly("cat", "dog", "lizard", "snake", "bird", "hamster", "horse");
        assertThat(jdbc.queryForList("SELECT name FROM specialties ORDER BY id", String.class))
                .containsExactly("radiology", "surgery", "dentistry");

        jdbc.update("INSERT INTO owners (first_name, last_name) VALUES ('Left', 'Behind')");
    }

    @Test
    @Order(2)
    void aRowTheTestBeforeCommittedIsGone() {
        assertThat(count("owners")).isZero();
    }

    @Test
    @Order(3)
    @DefaultFixture
    void aTestThatDeclaresTheDefaultFixtureStartsOnTheSeed() {
        assertThat(jdbc.queryForObject("SELECT first_name || ' ' || last_name FROM owners WHERE id = 1", String.class))
                .isEqualTo("Kevin McCallister");
        assertThat(jdbc.queryForObject("SELECT name FROM pets WHERE id = 3", String.class)).isEqualTo("Milton");
        assertThat(count("users")).isEqualTo(1);
        assertThat(count("types")).as("the seed points at the reference rows, it does not repeat them").isEqualTo(7);
    }

    @Test
    @Order(4)
    void andTheOneAfterItIsEmptyAgain() {
        assertThat(count("owners")).isZero();
        assertThat(count("types")).isEqualTo(7);
    }
}
