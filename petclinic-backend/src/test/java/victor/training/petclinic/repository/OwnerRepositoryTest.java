package victor.training.petclinic.repository;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import victor.training.petclinic.model.Owner;
import victor.training.petclinic.model.Pet;
import victor.training.petclinic.model.PetType;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@Transactional
class OwnerRepositoryTest {

    @Autowired
    OwnerRepository ownerRepository;
    @Autowired
    PetRepository petRepository;
    @Autowired
    PetTypeRepository petTypeRepository;

    Owner silva;
    Owner davis;

    @BeforeEach
    void setUp() {
        PetType dog = new PetType();
        dog.setName("dog");
        dog = petTypeRepository.save(dog);

        silva = new Owner();
        silva.setFirstName("Maria");
        silva.setLastName("Silva");
        silva.setAddress("Main St 1");
        silva.setCity("Lisbon");
        silva.setTelephone("0722000001");
        silva = ownerRepository.save(silva);

        Pet buddy = new Pet();
        buddy.setName("Buddy");
        buddy.setBirthDate(LocalDate.now());
        buddy.setOwner(silva);
        buddy.setType(dog);
        buddy = petRepository.save(buddy);
        silva.addPet(buddy);

        davis = new Owner();
        davis.setFirstName("John");
        davis.setLastName("Davis");
        davis.setAddress("Oak Ave 5");
        davis.setCity("London");
        davis.setTelephone("0733000002");
        davis = ownerRepository.save(davis);

        Pet whiskers = new Pet();
        whiskers.setName("Whiskers");
        whiskers.setBirthDate(LocalDate.now());
        whiskers.setOwner(davis);
        whiskers.setType(dog);
        whiskers = petRepository.save(whiskers);
        davis.addPet(whiskers);
    }

    private List<Integer> ids(List<Owner> owners) {
        return owners.stream().map(Owner::getId).toList();
    }

    @Test
    void searchByLastName() {
        assertThat(ids(ownerRepository.searchAcrossAllFields("Silva")))
            .contains(silva.getId())
            .doesNotContain(davis.getId());
    }

    @Test
    void searchByFirstName() {
        assertThat(ids(ownerRepository.searchAcrossAllFields("Maria")))
            .contains(silva.getId())
            .doesNotContain(davis.getId());
    }

    @Test
    void searchByAddress() {
        assertThat(ids(ownerRepository.searchAcrossAllFields("Main")))
            .contains(silva.getId())
            .doesNotContain(davis.getId());
    }

    @Test
    void searchByCity() {
        assertThat(ids(ownerRepository.searchAcrossAllFields("Lisbon")))
            .contains(silva.getId())
            .doesNotContain(davis.getId());
    }

    @Test
    void searchByTelephone() {
        assertThat(ids(ownerRepository.searchAcrossAllFields("0722")))
            .contains(silva.getId())
            .doesNotContain(davis.getId());
    }

    @Test
    void searchByPetName() {
        assertThat(ids(ownerRepository.searchAcrossAllFields("Buddy")))
            .contains(silva.getId())
            .doesNotContain(davis.getId());
    }

    @Test
    void searchByPetNamePartial() {
        assertThat(ids(ownerRepository.searchAcrossAllFields("Whisk")))
            .contains(davis.getId())
            .doesNotContain(silva.getId());
    }

    @Test
    void searchCaseInsensitive() {
        assertThat(ids(ownerRepository.searchAcrossAllFields("silva")))
            .contains(silva.getId());
        assertThat(ids(ownerRepository.searchAcrossAllFields("DAVIS")))
            .contains(davis.getId());
    }

    @Test
    void emptySearchReturnsAll() {
        assertThat(ids(ownerRepository.searchAcrossAllFields("")))
            .contains(silva.getId(), davis.getId());
    }
}
