package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;

/** Proves on the same binaries CI runs that ICU and unaccent do what #25's design relies on. */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
class OwnerListingSchemaTest {

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void lettersWithDiacriticsSortNextToTheirBaseLetter() {
        jdbc.update("""
                INSERT INTO owners (first_name, last_name, address, city, telephone) VALUES
                    ('Tom', 'Riddle', 'a', 'c', '1'),
                    ('Ștefan', 'Mureșan', 'a', 'c', '1'),
                    ('Sam', 'Carraclough', 'a', 'c', '1')""");

        List<String> names = jdbc.queryForList("SELECT first_name FROM owners ORDER BY first_name", String.class);

        assertThat(names).containsExactly("Sam", "Ștefan", "Tom");
    }

    @ParameterizedTest
    @CsvSource({"Mureșan, muresan", "Śliwiński, sliwinski", "POTTER, potter", "Łukasz, lukasz", "Martín, martin"})
    void searchKeyDropsCaseAndDiacritics(String name, String expected) {
        assertThat(jdbc.queryForObject("SELECT search_key(?)", String.class, name)).isEqualTo(expected);
    }
}
