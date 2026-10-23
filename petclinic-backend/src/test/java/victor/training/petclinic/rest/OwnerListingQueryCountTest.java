package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.persistence.EntityManagerFactory;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.PetType;
import victor.training.petclinic.domain.Visit;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.PetTypeRepository;
import victor.training.petclinic.repository.VisitRepository;

/** A page of owners costs the same number of queries whatever its size: no N+1 over pets or their visits. */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
class OwnerListingQueryCountTest {

    @Autowired
    MockMvc mockMvc;
    @Autowired
    EntityManagerFactory entityManagerFactory;
    @Autowired
    OwnerRepository ownerRepository;
    @Autowired
    PetRepository petRepository;
    @Autowired
    PetTypeRepository petTypeRepository;
    @Autowired
    VisitRepository visitRepository;

    @Test
    void aPageOf20CostsAsManyQueriesAsAPageOf5() throws Exception {
        givenOwnersWithTwoPetsWithTwoVisitsEach(20);

        long queriesFor5 = queriesToLoad("/api/owners?size=5");
        long queriesFor20 = queriesToLoad("/api/owners?size=20");

        assertThat(queriesFor20).isEqualTo(queriesFor5);
    }

    private long queriesToLoad(String uri) throws Exception {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
        mockMvc.perform(get(uri)).andExpect(status().isOk());
        return statistics.getPrepareStatementCount();
    }

    private void givenOwnersWithTwoPetsWithTwoVisitsEach(int ownerCount) {
        PetType dog = petTypeRepository.save(TestData.aPetType("dog-" + System.nanoTime()));
        for (int i = 0; i < ownerCount; i++) {
            Owner owner = TestData.anOwner();
            owner.setFirstName("Owner%02d".formatted(i));
            owner = ownerRepository.save(owner);
            for (int p = 0; p < 2; p++) {
                Pet pet = TestData.aPet();
                pet.setOwner(owner);
                pet.setType(dog);
                pet = petRepository.save(pet);
                for (int v = 0; v < 2; v++) {
                    Visit visit = new Visit();
                    visit.setDescription("checkup " + v);
                    visit.setPet(pet);
                    visitRepository.save(visit);
                }
            }
        }
    }
}
