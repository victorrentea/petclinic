package victor.training.petclinic.repository;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.PetType;

/**
 * "Pets" sorts by the NUMBER of pets. petCount is not a column, so it only works as a
 * sortable property because Owner declares it as a Hibernate @Formula (D3).
 */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
@Transactional
class OwnerPetCountSortTest {

    @Autowired
    OwnerRepository ownerRepository;

    @Autowired
    PetRepository petRepository;

    @Autowired
    PetTypeRepository petTypeRepository;

    @PersistenceContext
    EntityManager entityManager;

    @Test
    void zeroPetOwnersComeFirstWhenSortingByPetCount() {
        Integer childless = saveOwnerWithPets("Fara", 0).getId();
        Integer oneDog = saveOwnerWithPets("Cuunul", 1).getId();
        Integer twoDogs = saveOwnerWithPets("Cudoi", 2).getId();
        // @Formula is evaluated on SELECT; entities still in the persistence context would be
        // returned with their stale in-memory value, hiding what the database actually ordered by.
        entityManager.flush();
        entityManager.clear();

        List<Owner> sorted = ownerRepository.findByLastNameStartingWith("",
                PageRequest.of(0, 1000, Sort.by("petCount", "lastName", "firstName", "id")))
                .getContent();

        assertThat(sorted).extracting(Owner::getPetCount).isSorted();
        assertThat(sorted.get(0).getPetCount()).isZero();
        assertThat(sorted).extracting(Owner::getId)
                .containsSubsequence(childless, oneDog, twoDogs);
    }

    private Owner saveOwnerWithPets(String lastName, int petCount) {
        Owner owner = ownerRepository.save(new Owner()
                .setFirstName("Ana")
                .setLastName(lastName)
                .setAddress("Str. Fictiva 1")
                .setCity("Bucuresti")
                .setTelephone("0722123456"));
        PetType type = petTypeRepository.findAll().iterator().next();
        for (int i = 0; i < petCount; i++) {
            petRepository.save(new Pet()
                    .setName(lastName + i)
                    .setBirthDate(LocalDate.now().minusYears(1))
                    .setType(type)
                    .setOwner(owner));
        }
        return owner;
    }
}
