package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.transaction.Transactional;

/**
 * Guards decision D6: {@code owners.last_name}, {@code first_name} and {@code city} are collated
 * {@code und-x-icu} (ICU root), so ordering is linguistic rather than byte order.
 * <p>
 * Under the cluster's {@code C} collation every lowercase-initial surname ({@code de Vries},
 * {@code van Gogh}) sorts after all uppercase-initial ones and every accented surname
 * ({@code Szabó}, {@code Ștefănescu}) after those — invisible in the 28-row ASCII seed, glaring
 * with 10k Dutch, Hungarian and Romanian names.
 */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@Transactional
class OwnerCollationTest {

    /**
     * The mixed nl/hu/ro fixture of D21. {@code Ștefănescu} precedes {@code Szabó} because ICU root
     * folds {@code Ș} to {@code S} and then compares {@code Ște…} against {@code Sza…}.
     */
    private static final List<String> MIXED_SURNAMES =
        List.of("Bakker", "de Vries", "Gogh", "Szabó", "Ștefănescu", "Tudor", "van Gogh");

    private static final List<String> EXPECTED_ROOT_ORDER =
        List.of("Bakker", "de Vries", "Gogh", "Ștefănescu", "Szabó", "Tudor", "van Gogh");

    @Autowired
    JdbcTemplate jdbcTemplate;

    @BeforeEach
    void insertFixture() {
        MIXED_SURNAMES.forEach(surname -> jdbcTemplate.update(
            "INSERT INTO owners (first_name, last_name, address, city, telephone) VALUES (?,?,?,?,?)",
            "Test", surname, "some address", "Springfield", "1234567890"));
    }

    @Test
    void undXIcuCollationIsAvailable() {
        Integer count = jdbcTemplate.queryForObject(
            "SELECT count(*) FROM pg_collation WHERE collname = 'und-x-icu'", Integer.class);

        assertThat(count)
            .as("und-x-icu must exist on the embedded PostgreSQL, or V9 fails only in CI")
            .isEqualTo(1);
    }

    @Test
    void lastNameSortsInLinguisticOrder() {
        assertThat(surnamesFromFixture("ORDER BY last_name")).containsExactlyElementsOf(EXPECTED_ROOT_ORDER);
    }

    @Test
    void configuredCollationOrdersIdenticallyToDutch() {
        assertThat(surnamesFromFixture("ORDER BY last_name"))
            .as("the Netherlands is the primary market; root was chosen because it equals nl-x-icu")
            .containsExactlyElementsOf(surnamesFromFixture("ORDER BY last_name COLLATE \"nl-x-icu\""));
    }

    /**
     * Pins the limitation D6 accepts: Hungarian treats {@code cs}/{@code sz}/{@code zs} as single
     * letters sorting after the base letter, so a Hungarian expects {@code Cukor, Czako, Csaba}.
     * Asserted here so that moving to per-locale ordering is a deliberate spec change rather than
     * an accident.
     */
    @Test
    void hungarianDivergenceIsAccepted() {
        List.of("Csaba", "Cukor", "Czako").forEach(surname -> jdbcTemplate.update(
            "INSERT INTO owners (first_name, last_name, address, city, telephone) VALUES (?,?,?,?,?)",
            "Test", surname, "some address", "Budapest", "1234567890"));

        List<String> rootOrder = jdbcTemplate.queryForList(
            "SELECT last_name FROM owners WHERE city = 'Budapest' ORDER BY last_name", String.class);

        assertThat(rootOrder).containsExactly("Csaba", "Cukor", "Czako");
        assertThat(rootOrder).isNotEqualTo(List.of("Cukor", "Czako", "Csaba"));
    }

    private List<String> surnamesFromFixture(String orderBy) {
        return jdbcTemplate.queryForList(
            "SELECT last_name FROM owners WHERE last_name IN ("
                + "'Bakker','de Vries','Gogh','Szabó','Ștefănescu','Tudor','van Gogh') " + orderBy,
            String.class);
    }
}
