package victor.training.petclinic.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import jakarta.persistence.EntityManagerFactory;
import jakarta.transaction.Transactional;
import victor.training.petclinic.model.Owner;
import victor.training.petclinic.model.Pet;
import victor.training.petclinic.model.PetType;
import victor.training.petclinic.rest.TestData;

/**
 * Repository-level coverage for paged + sorted owner search and batched pet loading.
 * Uses {@code @SpringBootTest} (the project's only test infra: full context + Flyway + Zonky)
 * rather than {@code @DataJpaTest}, which does not run Flyway here.
 */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@Transactional
class OwnerRepositoryPagingTest {

    @Autowired
    OwnerRepository ownerRepository;

    @Autowired
    PetRepository petRepository;

    @Autowired
    PetTypeRepository petTypeRepository;

    @Autowired
    EntityManagerFactory entityManagerFactory;

    @BeforeEach
    void seed() {
        String[] lastNames = {"Zphan", "Zaccaria", "Zorro", "Zyler", "Zeppelin",
            "Zander", "Zimm", "Zola", "Zane", "Zucker", "Zev", "Zinn"};
        PetType dog = petTypeRepository.save(new PetType().setName("dog"));
        for (int i = 0; i < lastNames.length; i++) {
            Owner owner = ownerRepository.save(TestData.anOwner().setLastName(lastNames[i]));
            // two pets each, to make batched loading observable
            petRepository.save(new Pet().setName("Pet" + i + "a").setOwner(owner).setType(dog));
            petRepository.save(new Pet().setName("Pet" + i + "b").setOwner(owner).setType(dog));
        }
    }

    @Test
    void pagesAndCountsByLastNamePrefix() {
        Page<Owner> page = ownerRepository.findByLastNameStartingWith(
            "Z", PageRequest.of(0, 5, Sort.by("lastName")));

        assertThat(page.getContent()).hasSize(5);
        assertThat(page.getSize()).isEqualTo(5);
        assertThat(page.getNumber()).isZero();
        assertThat(page.getTotalElements()).isGreaterThanOrEqualTo(12);
        assertThat(page.getContent()).allMatch(o -> o.getLastName().startsWith("Z"));
    }

    @Test
    void appliesSortOnTheRequestedColumn() {
        Page<Owner> page = ownerRepository.findByLastNameStartingWith(
            "Z", PageRequest.of(0, 12, Sort.by(Sort.Direction.ASC, "lastName")));

        List<String> lastNames = page.getContent().stream().map(Owner::getLastName).toList();
        assertThat(lastNames).isSorted();
    }

    @Test
    void loadsPetsBatched_notOneQueryPerOwner() {
        SessionFactory sessionFactory = entityManagerFactory.unwrap(SessionFactory.class);
        Statistics stats = sessionFactory.getStatistics();
        stats.setStatisticsEnabled(true);

        Page<Owner> page = ownerRepository.findByLastNameStartingWith(
            "Z", PageRequest.of(0, 10, Sort.by("lastName")));
        stats.clear();

        // Force lazy pet collections to initialize for the whole page.
        page.getContent().forEach(owner -> owner.getPets().size());

        // With @BatchSize the 10 collections load in a single batched select, not 10.
        assertThat(stats.getPrepareStatementCount()).isLessThanOrEqualTo(2L);
    }
}
