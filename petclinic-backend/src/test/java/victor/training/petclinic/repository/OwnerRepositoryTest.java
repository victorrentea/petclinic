package victor.training.petclinic.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.JdbcTemplate;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.transaction.Transactional;
import victor.training.petclinic.domain.Owner;

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@Transactional
class OwnerRepositoryTest {
    @Autowired
    OwnerRepository ownerRepository;
    @Autowired
    JdbcTemplate jdbc;

    @Test
    void accentedSurnamesSortNextToTheirBaseLetter() {
        for (String lastName : List.of("Wensleydale", "Śliwiński", "Tremaine", "Silver")) {
            ownerRepository.save(owner("Ann", lastName, "London"));
        }

        List<String> lastNames = ownerRepository
                .findByLastNameStartingWith("", PageRequest.of(0, 10, Sort.by("lastName")))
                .map(Owner::getLastName).getContent();

        assertThat(lastNames).containsExactly("Silver", "Śliwiński", "Tremaine", "Wensleydale");
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "last_name, first_name, id                  | owners_name_idx",
            "last_name DESC, first_name DESC, id DESC   | owners_name_idx",
            "city, id                                   | owners_city_idx",
            "city DESC, id DESC                         | owners_city_idx"})
    void aPageOf50kOwnersIsReadOffTheIndexOfItsSort(String orderBy, String index) {
        jdbc.update("""
                INSERT INTO owners (first_name, last_name, address, city, telephone)
                SELECT 'First' || n, 'Last' || (n % 5000), 'Street ' || n, 'City' || (n % 300), '0700' || n
                FROM generate_series(1, 50000) n""");
        jdbc.execute("ANALYZE owners");

        String plan = String.join("\n", jdbc.queryForList(
                "EXPLAIN SELECT * FROM owners WHERE last_name LIKE 'Last1%' ORDER BY " + orderBy
                        + " OFFSET 40 LIMIT 20",
                String.class));

        assertThat(plan).contains("Index Scan").contains(index).doesNotContain("Sort  (");
    }

    static Owner owner(String firstName, String lastName, String city) {
        Owner owner = new Owner();
        owner.setFirstName(firstName);
        owner.setLastName(lastName);
        owner.setCity(city);
        owner.setAddress("Baker St 221B");
        owner.setTelephone("1234567890");
        return owner;
    }
}
