package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;

import org.hibernate.SessionFactory;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
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

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@TestPropertySource(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
class OwnerListQueryCountTest {

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
    void numberOfQueriesDoesNotGrowWithThePageSize() throws Exception {
        PetType type = petTypeRepository.save(TestData.aPetType("dog"));
        for (int i = 0; i < 20; i++) {
            saveOwnerWithTwoPetsOfTwoVisits(type, "Owner%02d".formatted(i));
        }

        long queriesForFiveOwners = queriesFor("/api/owners?size=5");
        long queriesForTwentyOwners = queriesFor("/api/owners?size=20");

        assertThat(queriesForTwentyOwners).isEqualTo(queriesForFiveOwners);
    }

    private long queriesFor(String uri) throws Exception {
        var statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
        mockMvc.perform(get(uri)).andExpect(status().isOk());
        return statistics.getPrepareStatementCount();
    }

    private void saveOwnerWithTwoPetsOfTwoVisits(PetType type, String firstName) {
        Owner owner = TestData.anOwner();
        owner.setFirstName(firstName);
        owner = ownerRepository.save(owner);
        for (int p = 0; p < 2; p++) {
            Pet pet = TestData.aPet();
            pet.setOwner(owner);
            pet.setType(type);
            pet = petRepository.save(pet);
            for (int v = 0; v < 2; v++) {
                Visit visit = new Visit();
                visit.setDate(LocalDate.now());
                visit.setDescription("checkup");
                visit.setPet(pet);
                visitRepository.save(visit);
            }
        }
    }
}
