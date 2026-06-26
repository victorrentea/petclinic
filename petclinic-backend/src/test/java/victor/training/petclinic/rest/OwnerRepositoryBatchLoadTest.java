package victor.training.petclinic.rest;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.test.context.support.WithMockUser;
import victor.training.petclinic.model.Owner;
import victor.training.petclinic.model.Pet;
import victor.training.petclinic.model.PetType;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.PetTypeRepository;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies that fetching a page of owners and then accessing their pets
 * does NOT produce N+1 queries — pets are batch-loaded via
 * {@code hibernate.default_batch_fetch_size}.
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerRepositoryBatchLoadTest {

    @Autowired OwnerRepository ownerRepository;
    @Autowired PetRepository petRepository;
    @Autowired PetTypeRepository petTypeRepository;
    @Autowired EntityManagerFactory emf;
    @PersistenceContext EntityManager em;

    @Test
    void fetchPageOfOwners_petsBatchLoaded_notN1() {
        // Arrange: 5 owners each with 1 pet
        PetType dog = new PetType();
        dog.setName("batchdog");
        dog = petTypeRepository.save(dog);

        for (int i = 0; i < 5; i++) {
            Owner owner = TestData.anOwner();
            owner.setLastName("BatchOwner" + i);
            owner = ownerRepository.save(owner);

            Pet pet = new Pet();
            pet.setName("Dog" + i);
            pet.setBirthDate(LocalDate.of(2021, 1, 1));
            pet.setOwner(owner);
            pet.setType(dog);
            petRepository.save(pet);
        }

        // Flush writes then evict L1 cache so lazy loading genuinely hits the DB
        em.flush();
        em.clear();

        Statistics stats = emf.unwrap(SessionFactory.class).getStatistics();
        stats.clear();

        // Act: scalar-only page query (no JOIN FETCH pets)
        Page<Owner> page = ownerRepository.findByLastNameStartingWith(
                "BatchOwner", PageRequest.of(0, 5, Sort.by("lastName")));
        assertThat(page.getContent()).hasSize(5);

        // Trigger lazy loading of pets for every owner
        page.getContent().forEach(o -> o.getPets().size());

        // Assert: 1 COUNT + 1 SELECT owners + 1 IN-batch for pets = 3 total statements.
        // Without batch loading it would be 2 + 5 = 7.  We allow up to 5 as a safe margin.
        long stmtCount = stats.getPrepareStatementCount();
        assertThat(stmtCount)
                .as("Expected batch-loaded pets (no N+1). Got %d prepared statements.", stmtCount)
                .isLessThanOrEqualTo(5);
    }
}
