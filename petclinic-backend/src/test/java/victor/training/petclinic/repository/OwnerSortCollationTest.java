package victor.training.petclinic.repository;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.data.repository.Repository;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.rest.TestData;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** The order comes from the columns' ICU collation (V4); the query only names the columns. */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
class OwnerSortCollationTest {

    interface SortedOwners extends Repository<Owner, Integer> {
        List<Owner> findAll(Sort sort);
    }

    @Autowired
    EntityManager entityManager;

    SortedOwners sortedOwners;

    @BeforeEach
    void createRepository() {
        sortedOwners = new JpaRepositoryFactory(entityManager).getRepository(SortedOwners.class);
    }

    @Test
    void namesSortByLinguisticRulesNotByteOrder() {
        save("Long", "Silver", "London");
        save("Łukasz", "Śliwiński", "London");
        save("Tom", "Thumb", "London");
        save("Rafael", "de la Cruz", "London");
        save("Ana", "Diaz", "London");

        List<Owner> owners = sortedOwners.findAll(Sort.by("lastName", "firstName", "id"));

        assertThat(owners).extracting(Owner::getLastName)
                .containsExactly("de la Cruz", "Diaz", "Silver", "Śliwiński", "Thumb");
    }

    @Test
    void citiesSortByLinguisticRulesNotByteOrder() {
        save("Ann", "Smith", "Madrid");
        save("Ann", "Smith", "Łódź");
        save("Ann", "Smith", "Lyon");

        List<Owner> owners = sortedOwners.findAll(Sort.by("city", "lastName", "firstName", "id"));

        // ICU root weighs Ł as L with a diacritic: "Łódź" sorts like "Lodz", among the L cities.
        // Byte order would put it after "Madrid"; only a Polish collation puts it after "Lyon".
        assertThat(owners).extracting(Owner::getCity)
                .containsExactly("Łódź", "Lyon", "Madrid");
    }

    @Test
    void eachSortChainHasItsIndex() {
        List<?> indexes = entityManager.createNativeQuery(
                "select indexdef from pg_indexes where tablename = 'owners'").getResultList();

        assertThat(indexes).asString()
                .contains("(last_name, first_name, id)")
                .contains("(city, last_name, first_name, id)");
    }

    private void save(String firstName, String lastName, String city) {
        Owner owner = TestData.anOwner();
        owner.setFirstName(firstName);
        owner.setLastName(lastName);
        owner.setCity(city);
        entityManager.persist(owner);
    }
}
