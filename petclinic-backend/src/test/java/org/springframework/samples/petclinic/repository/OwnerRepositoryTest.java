package org.springframework.samples.petclinic.repository;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.samples.petclinic.model.Owner;
import org.springframework.samples.petclinic.model.Pet;
import org.springframework.samples.petclinic.model.PetType;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
class OwnerRepositoryTest {

    @Autowired OwnerRepository ownerRepository;
    @Autowired PetRepository petRepository;
    @Autowired PetTypeRepository petTypeRepository;

    private Owner savedOwner(String firstName, String lastName) {
        return ownerRepository.save(new Owner()
            .setFirstName(firstName)
            .setLastName(lastName)
            .setAddress("123 Main St")
            .setCity("Springfield")
            .setTelephone("1234567890"));
    }

    @Test
    void findByQuery_blankFilter_returnsPaginatedResults() {
        for (int i = 0; i < 12; i++) {
            savedOwner("First" + i, "Last" + i);
        }

        Page<Owner> page = ownerRepository.findByQuery("", PageRequest.of(0, 10));

        assertThat(page.getContent()).hasSize(10);
        assertThat(page.getTotalElements()).isGreaterThanOrEqualTo(12);
        assertThat(page.getTotalPages()).isGreaterThanOrEqualTo(2);
    }

    @Test
    void findByQuery_filterByLastName_returnsOnlyMatching() {
        savedOwner("Betty", "Davis");
        savedOwner("George", "Franklin");

        Page<Owner> page = ownerRepository.findByQuery("%Davis%", PageRequest.of(0, 10));

        assertThat(page.getContent())
            .extracting(Owner::getLastName)
            .containsOnly("Davis");
    }

    @Test
    void findByQuery_diacriticSearch_matchesStoredAccentedName() {
        savedOwner("Müller", "Hans");

        Page<Owner> page = ownerRepository.findByQuery("%Muller%", PageRequest.of(0, 10));

        assertThat(page.getContent())
            .extracting(Owner::getFirstName)
            .contains("Müller");
    }

    @Test
    void findByQuery_searchByPetName_returnsOwner() {
        Owner owner = savedOwner("John", "Smith");
        PetType type = petTypeRepository.save(new PetType().setName("cat"));
        petRepository.save(new Pet()
            .setName("Whiskers")
            .setBirthDate(LocalDate.now())
            .setOwner(owner)
            .setType(type));

        Page<Owner> page = ownerRepository.findByQuery("%Whiskers%", PageRequest.of(0, 10));

        assertThat(page.getContent())
            .extracting(Owner::getLastName)
            .contains("Smith");
    }

    @Test
    void findByQuery_ownerWithMultiplePets_noDuplicates() {
        Owner owner = savedOwner("Jane", "Doe");
        PetType type = petTypeRepository.save(new PetType().setName("dog"));
        petRepository.save(new Pet().setName("Fluffy").setBirthDate(LocalDate.now()).setOwner(owner).setType(type));
        petRepository.save(new Pet().setName("Fluffball").setBirthDate(LocalDate.now()).setOwner(owner).setType(type));

        Page<Owner> page = ownerRepository.findByQuery("%Fluff%", PageRequest.of(0, 10));

        assertThat(page.getContent())
            .extracting(Owner::getId)
            .containsOnlyOnce(owner.getId());
    }

    @Test
    void findByQuery_sortByFirstName_returnsInOrder() {
        savedOwner("Zara", "Alpha");
        savedOwner("Anna", "Beta");

        Page<Owner> page = ownerRepository.findByQuery("",
            PageRequest.of(0, 10, Sort.by(Sort.Direction.ASC, "firstName")));

        var names = page.getContent().stream().map(Owner::getFirstName).toList();
        assertThat(names).isSortedAccordingTo(String::compareTo);
    }

    @Test
    void findByQuery_filteredQuery_totalElementsIsAccurate() {
        savedOwner("Betty", "Davis");
        savedOwner("Betty2", "Davis");
        savedOwner("George", "Franklin");

        Page<Owner> page = ownerRepository.findByQuery("%Davis%", PageRequest.of(0, 1));

        assertThat(page.getTotalElements()).isGreaterThanOrEqualTo(2);
        assertThat(page.getTotalPages()).isGreaterThanOrEqualTo(2);
        assertThat(page.getContent()).hasSize(1); // page size is 1, so only one result
    }
}
