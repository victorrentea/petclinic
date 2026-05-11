package victor.training.petclinic.repository;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import victor.training.petclinic.model.Owner;
import victor.training.petclinic.model.Pet;
import victor.training.petclinic.model.PetType;

import java.time.LocalDate;

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

    int georgeId;
    int bettyId;

    @BeforeEach
    void setUp() {
        Owner george = new Owner()
            .setFirstName("Zymurgy")
            .setLastName("Xanthippe")
            .setAddress("1 Unique St.")
            .setCity("Neverland")
            .setTelephone("0000000001");
        georgeId = ownerRepository.save(george).getId();

        Owner betty = new Owner()
            .setFirstName("Quetzal")
            .setLastName("Fjordsen")
            .setAddress("2 Unique Ave.")
            .setCity("Zanzibar")
            .setTelephone("0000000002");
        bettyId = ownerRepository.save(betty).getId();

        PetType dog = new PetType();
        dog.setName("dog");
        dog = petTypeRepository.save(dog);

        Pet fluffy = new Pet();
        fluffy.setName("Zzxqpet");
        fluffy.setBirthDate(LocalDate.now());
        fluffy.setOwner(betty);
        fluffy.setType(dog);
        petRepository.save(fluffy);
    }

    @Test
    void search_byLastName() {
        Page<Owner> result = ownerRepository.search("Xanthippe", PageRequest.of(0, 20));
        assertThat(result.getContent()).extracting(Owner::getId).containsExactly(georgeId);
        assertThat(result.getTotalElements()).isEqualTo(1);
    }

    @Test
    void search_byFirstName() {
        Page<Owner> result = ownerRepository.search("Zymurgy", PageRequest.of(0, 20));
        assertThat(result.getContent()).extracting(Owner::getId).containsExactly(georgeId);
    }

    @Test
    void search_byCity_caseInsensitive() {
        Page<Owner> result = ownerRepository.search("zanzibar", PageRequest.of(0, 20));
        assertThat(result.getContent()).extracting(Owner::getId).containsExactly(bettyId);
    }

    @Test
    void search_byPetName() {
        Page<Owner> result = ownerRepository.search("zzxqpet", PageRequest.of(0, 20));
        assertThat(result.getContent()).extracting(Owner::getId).containsExactly(bettyId);
    }

    @Test
    void search_blank_returnsAll() {
        Page<Owner> result = ownerRepository.search("", PageRequest.of(0, 20));
        assertThat(result.getTotalElements()).isGreaterThanOrEqualTo(2);
    }

    @Test
    void search_null_returnsAll() {
        Page<Owner> result = ownerRepository.search(null, PageRequest.of(0, 20));
        assertThat(result.getTotalElements()).isGreaterThanOrEqualTo(2);
    }

    @Test
    void search_pagination() {
        Page<Owner> page0 = ownerRepository.search("", PageRequest.of(0, 1));
        Page<Owner> page1 = ownerRepository.search("", PageRequest.of(1, 1));
        assertThat(page0.getContent()).hasSize(1);
        assertThat(page1.getContent()).hasSize(1);
        assertThat(page0.getContent().get(0).getId()).isNotEqualTo(page1.getContent().get(0).getId());
        assertThat(page0.getTotalElements()).isGreaterThanOrEqualTo(2);
    }
}
