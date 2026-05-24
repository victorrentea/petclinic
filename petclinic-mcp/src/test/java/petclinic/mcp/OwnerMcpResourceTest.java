package petclinic.mcp;

import java.time.LocalDate;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import victor.training.petclinic.model.Owner;
import victor.training.petclinic.model.Pet;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Transactional
class OwnerMcpResourceTest {

    @Autowired OwnerMcpResource ownerMcpResource;
    @Autowired OwnerRepository ownerRepository;
    @Autowired PetRepository petRepository;

    @Test
    void renders_profile_with_pets_for_authenticated_owner() {
        Owner ron = new Owner();
        ron.setFirstName("Ronald");
        ron.setLastName("Weasley_TST");
        ron.setAddress("The Burrow");
        ron.setCity("Ottery St Catchpole");
        ron.setTelephone("0119544321");
        Pet pet = new Pet();
        pet.setName("Scabbers");
        pet.setBirthDate(LocalDate.of(2018, 6, 1));
        pet.setType(petRepository.findPetTypes().get(0));
        ron.addPet(pet);
        ownerRepository.save(ron);

        String profile = ownerMcpResource.profileFor(ron.getId());

        assertThat(profile)
            .contains("Ronald Weasley_TST")
            .contains("The Burrow")
            .contains("Scabbers");
    }

    @Test
    void unknown_id_throws() {
        assertThatThrownBy(() -> ownerMcpResource.profileFor(999_999))
            .isInstanceOf(IllegalStateException.class);
    }
}
