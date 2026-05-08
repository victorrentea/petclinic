package org.springframework.samples.petclinic.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.samples.petclinic.model.Owner;
import org.springframework.samples.petclinic.model.Pet;
import org.springframework.samples.petclinic.model.PetType;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.transaction.Transactional;

/**
 * Integration test for OwnerRepository.findBySearch method.
 * Tests the unified search functionality across owner fields and pet names.
 */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@Transactional
public class OwnerRepositorySearchTest {

    @Autowired
    private OwnerRepository ownerRepository;

    @Autowired
    private PetTypeRepository petTypeRepository;

    private Pageable defaultPageable() {
        return PageRequest.of(0, 100, Sort.by("firstName").ascending().and(Sort.by("lastName").ascending()));
    }

    @Test
    void findBySearch_nullQuery_returnsAllOwners() {
        // Given: sample data exists from Flyway migrations
        
        // When: searching with null
        Page<Owner> results = ownerRepository.findBySearch(null, defaultPageable());

        // Then: should return all owners (at least the sample data)
        assertThat(results.getContent()).isNotEmpty();
    }

    @Test
    void findBySearch_emptyQuery_returnsAllOwners() {
        // Given: sample data exists from Flyway migrations
        
        // When: searching with empty string
        Page<Owner> results = ownerRepository.findBySearch("", defaultPageable());

        // Then: should return all owners
        assertThat(results.getContent()).isNotEmpty();
    }

    @Test
    void findBySearch_byFirstName_caseInsensitive() {
        // Given: sample data contains owner with firstName "George"
        
        // When: searching with lowercase
        Page<Owner> results = ownerRepository.findBySearch("george", defaultPageable());

        // Then: should find at least one owner
        assertThat(results.getContent()).isNotEmpty();
        assertThat(results.getContent())
            .anyMatch(o -> o.getFirstName().equalsIgnoreCase("George"));
    }

    @Test
    void findBySearch_byLastName_partialMatch() {
        // Given: sample data contains owners with various last names
        
        // When: searching with partial last name
        Page<Owner> results = ownerRepository.findBySearch("Frank", defaultPageable());

        // Then: should find owners with "Franklin" in last name
        assertThat(results.getContent()).isNotEmpty();
        assertThat(results.getContent())
            .anyMatch(o -> o.getLastName().contains("Frank"));
    }

    @Test
    void findBySearch_byCity() {
        // Given: sample data contains owners in Madison
        
        // When: searching by city
        Page<Owner> results = ownerRepository.findBySearch("Madison", defaultPageable());

        // Then: should find owners in Madison
        assertThat(results.getContent()).isNotEmpty();
        assertThat(results.getContent())
            .allMatch(o -> o.getCity().contains("Madison"));
    }

    @Test
    void findBySearch_byPetName() {
        // Given: Create a unique owner with a unique pet name
        PetType petType = new PetType();
        petType.setName("TestDog");
        petType = petTypeRepository.save(petType);

        Owner owner = new Owner();
        owner.setFirstName("TestFirst");
        owner.setLastName("TestLast");
        owner.setAddress("123 Test St");
        owner.setCity("TestCity");
        owner.setTelephone("1234567890");
        owner = ownerRepository.save(owner);

        Pet pet = new Pet();
        pet.setName("UniqueTestPetName");
        pet.setBirthDate(LocalDate.of(2020, 1, 1));
        pet.setType(petType);
        owner.addPet(pet);
        owner = ownerRepository.save(owner);

        // When: searching by pet name
        Page<Owner> results = ownerRepository.findBySearch("UniqueTestPetName", defaultPageable());

        // Then: should find the owner
        assertThat(results.getContent()).hasSize(1);
        assertThat(results.getContent().get(0).getFirstName()).isEqualTo("TestFirst");
    }

    @Test
    void findBySearch_noDuplicates_whenMultiplePetsMatch() {
        // Given: Create owner with multiple pets that match the search
        PetType petType = new PetType();
        petType.setName("TestCat");
        petType = petTypeRepository.save(petType);

        Owner owner = new Owner();
        owner.setFirstName("MultiPetOwner");
        owner.setLastName("TestOwner");
        owner.setAddress("456 Test Ave");
        owner.setCity("TestTown");
        owner.setTelephone("9876543210");
        owner = ownerRepository.save(owner);

        Pet pet1 = new Pet();
        pet1.setName("Fluffy");
        pet1.setBirthDate(LocalDate.of(2020, 1, 1));
        pet1.setType(petType);
        owner.addPet(pet1);

        Pet pet2 = new Pet();
        pet2.setName("Fluffball");
        pet2.setBirthDate(LocalDate.of(2021, 1, 1));
        pet2.setType(petType);
        owner.addPet(pet2);

        owner = ownerRepository.save(owner);
        Integer ownerId = owner.getId();

        // When: searching for "Fluff" which matches both pets
        Page<Owner> results = ownerRepository.findBySearch("Fluff", defaultPageable());

        // Then: owner should appear only once
        long countOfOwner = results.getContent().stream()
            .filter(o -> o.getId().equals(ownerId))
            .count();
        assertThat(countOfOwner).isEqualTo(1);
    }

    @Test
    void findBySearch_noMatch_returnsEmpty() {
        // When: searching for something that doesn't exist
        Page<Owner> results = ownerRepository.findBySearch("XyZzZzNonExistentSearchTerm12345", defaultPageable());

        // Then: should return empty
        assertThat(results.getContent()).isEmpty();
    }

    @Test
    void findBySearch_sortedByFirstNameThenLastName() {
        // Given: sample data exists
        
        // When: searching with a common term
        Page<Owner> results = ownerRepository.findBySearch("e", defaultPageable());

        // Then: results should be sorted by firstName, then lastName
        assertThat(results.getContent()).isNotEmpty();
        
        // Verify sorting
        for (int i = 0; i < results.getContent().size() - 1; i++) {
            Owner current = results.getContent().get(i);
            Owner next = results.getContent().get(i + 1);
            
            int firstNameComparison = current.getFirstName().compareTo(next.getFirstName());
            if (firstNameComparison == 0) {
                // If first names are equal, last name should be in order
                assertThat(current.getLastName()).isLessThanOrEqualTo(next.getLastName());
            } else {
                // First names should be in ascending order
                assertThat(firstNameComparison).isLessThanOrEqualTo(0);
            }
        }
    }
}
