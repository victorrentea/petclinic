package victor.training.petclinic.repository;

import static org.assertj.core.api.Assertions.assertThat;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.rest.TestData;

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@Transactional
class OwnerCollationTest {
    @Autowired
    OwnerRepository ownerRepository;

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void plainOrderByLastName_putsAccentedInitialsNextToTheirBaseLetter() {
        saveOwnerNamed("Wensleydale");
        saveOwnerNamed("Śliwiński");
        saveOwnerNamed("Silver");

        var lastNames = jdbc.queryForList("SELECT last_name FROM owners ORDER BY last_name", String.class);

        assertThat(lastNames).containsExactly("Silver", "Śliwiński", "Wensleydale");
    }

    private void saveOwnerNamed(String lastName) {
        Owner owner = TestData.anOwner();
        owner.setLastName(lastName);
        ownerRepository.save(owner);
    }
}
