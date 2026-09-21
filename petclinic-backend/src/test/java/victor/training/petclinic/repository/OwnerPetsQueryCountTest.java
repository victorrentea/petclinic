package victor.training.petclinic.repository;

import static org.assertj.core.api.Assertions.assertThat;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.persistence.EntityManagerFactory;
import jakarta.transaction.Transactional;
import victor.training.petclinic.domain.Owner;

/**
 * Reading a page of owners with their pets must cost a constant number of statements, whatever
 * the page size: the select for the page, the count behind the envelope, and one batched select
 * for the pets — never one select per owner.
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@Transactional
class OwnerPetsQueryCountTest {

    private static final int STATEMENTS_PER_PAGE = 3; // page + count + batched pets

    @Autowired
    OwnerRepository ownerRepository;

    @Autowired
    EntityManagerFactory entityManagerFactory;

    @Test
    void aPageOfOwnersWithPetsCostsAConstantNumberOfStatements() {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();

        Page<Owner> page = ownerRepository.findByLastNameStartingWith("",
                PageRequest.of(0, 10, Sort.by("lastName", "firstName", "id")));
        page.getContent().forEach(owner -> owner.getPets().size());

        assertThat(page.getContent()).hasSize(10);
        assertThat(statistics.getPrepareStatementCount())
                .as("one select per owner means the list does not scale; @BatchSize collapses them")
                .isLessThanOrEqualTo(STATEMENTS_PER_PAGE);
    }
}
