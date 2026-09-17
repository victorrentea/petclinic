package victor.training.petclinic.repository;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import victor.training.petclinic.domain.Owner;

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@Transactional
class OwnerRepositoryTest {

    private static final String PREFIX = "OwnerRepoTestPrefix";

    @Autowired
    OwnerRepository ownerRepository;

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void findByLastNameStartingWith_appliesFilterPagingAndSort() {
        insertOwner(PREFIX + "Zed", "Zoe", "Zville");
        insertOwner(PREFIX + "Amy", "Ann", "Aville");
        insertOwner("SomeoneElse", "Nope", "Nowhere");

        Page<Owner> firstPage = ownerRepository.findByLastNameStartingWith(PREFIX,
                PageRequest.of(0, 1, Sort.by(Sort.Order.asc("lastName"))));

        assertThat(firstPage.getTotalElements()).isEqualTo(2);
        assertThat(firstPage.getTotalPages()).isEqualTo(2);
        assertThat(firstPage.getContent()).extracting(Owner::getLastName).containsExactly(PREFIX + "Amy");

        Page<Owner> secondPage = ownerRepository.findByLastNameStartingWith(PREFIX,
                PageRequest.of(1, 1, Sort.by(Sort.Order.asc("lastName"))));
        assertThat(secondPage.getContent()).extracting(Owner::getLastName).containsExactly(PREFIX + "Zed");
    }

    private void insertOwner(String lastName, String firstName, String city) {
        jdbc.update("INSERT INTO owners (first_name, last_name, address, city, telephone) "
                + "VALUES (?, ?, 'addr', ?, '0000000000')", firstName, lastName, city);
    }
}
