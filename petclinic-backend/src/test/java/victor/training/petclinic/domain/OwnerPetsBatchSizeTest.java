package victor.training.petclinic.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import java.util.Collection;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.transaction.annotation.Transactional;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.persistence.EntityManagerFactory;
import victor.training.petclinic.mapper.OwnerMapper;
import victor.training.petclinic.repository.OwnerRepository;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

/**
 * Confirms @BatchSize (design.md Decision 7) turns serving a page of owners into a handful of
 * batched queries, not one query per owner and one per pet (Hibernate's HHH000104 N+1 warning).
 * Counted across the FULL mapping + JSON serialization, not just Owner::getPets, because
 * OwnerDto also carries every pet's visits — where the N+1 reappeared once Owner.pets was fixed.
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@Transactional
class OwnerPetsBatchSizeTest {

    @Autowired
    OwnerRepository ownerRepository;

    @Autowired
    EntityManagerFactory entityManagerFactory;

    @Autowired
    OwnerMapper ownerMapper;

    private final ObjectMapper jsonMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    private static final int MAX_BATCHED_QUERIES_PER_PAGE = 5;

    @Test
    void servingAPageOfOwnersIssuesOnlyBatchedQueries() throws Exception {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();

        Pageable pageable = PageRequest.of(0, 20, Sort.by(Sort.Order.asc("id")));
        Page<Owner> page = ownerRepository.findByLastNameStartingWith("", pageable);
        long queriesBeforeAccessingPets = statistics.getPrepareStatementCount();

        long petsOnPage = page.getContent().stream().map(Owner::getPets).mapToLong(Collection::size).sum();
        jsonMapper.writeValueAsString(ownerMapper.toOwnerDtoCollection(page.getContent()));

        long queriesIssued = statistics.getPrepareStatementCount() - queriesBeforeAccessingPets;
        assertThat(petsOnPage).as("fixture must have enough pets for an N+1 to stand out").isGreaterThan(5);
        assertThat(queriesIssued)
                .as("a fixed handful of batched queries for the whole page (pets, visits, pet types), "
                        + "not one per owner or one per pet")
                .isLessThanOrEqualTo(MAX_BATCHED_QUERIES_PER_PAGE);
    }
}
