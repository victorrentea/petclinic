package victor.training.petclinic.repository;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.test.context.TestPropertySource;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.transaction.Transactional;
import victor.training.petclinic.domain.Owner;

/**
 * Ordering must follow Romanian locale rules, not byte values: 'Ș' belongs next to 'S',
 * and a lowercase name is not exiled past 'Z'. Enforced by the column collation pinned in
 * V9__owner_name_collation.sql, so no Java code participates - hence a repository-level test.
 *
 * The cluster is deliberately initialised with the C locale, matching the dev/prod database.
 * Without it the test would pass on the developer's OS locale alone and prove nothing about
 * the schema - the very "green in CI, wrong in production" failure D5 exists to prevent.
 */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
@TestPropertySource(properties = {
        "zonky.test.database.postgres.initdb.properties.lc-collate=C",
        "zonky.test.database.postgres.initdb.properties.lc-ctype=C"
})
@Transactional
class OwnerNameCollationTest {

    @Autowired
    OwnerRepository ownerRepository;

    @Test
    void namesSortByRomanianLocaleRatherThanByteValue() {
        List.of("Pana", "popescu", "Radu", "Stan", "Ștefan", "Tudor", "Zamfir")
                .forEach(this::saveOwnerNamed);

        List<String> lastNames = ownerRepository.findByLastNameStartingWith("",
                PageRequest.of(0, 1000, Sort.by("lastName", "firstName", "id")))
                .map(Owner::getLastName)
                .getContent();

        assertThat(lastNames).containsSubsequence(
                "Pana", "popescu", "Radu", "Stan", "Ștefan", "Tudor", "Zamfir");
    }

    private void saveOwnerNamed(String lastName) {
        ownerRepository.save(new Owner()
                .setFirstName("Ion")
                .setLastName(lastName)
                .setAddress("Str. Fictiva 1")
                .setCity("Bucuresti")
                .setTelephone("0722123456"));
    }
}
