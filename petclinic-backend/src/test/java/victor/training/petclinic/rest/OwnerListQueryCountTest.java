package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import jakarta.transaction.Transactional;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.PetType;
import victor.training.petclinic.domain.Visit;

/** A page of owners costs the same few statements whatever its size: no N+1 over pets or visits. */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerListQueryCountTest {
    private static final int PAGE_SIZE = 20;

    @Autowired
    MockMvc mockMvc;

    @Autowired
    EntityManager entityManager;

    @Autowired
    EntityManagerFactory entityManagerFactory;

    @Test
    void aFullPageOfOwnersWithPetsAndVisits_takesAtMostFiveStatements() throws Exception {
        PetType dog = persist(TestData.aPetType("dog"));
        for (int i = 0; i < PAGE_SIZE; i++) {
            persistOwnerWithAPetAndAVisit(dog);
        }
        entityManager.flush();
        entityManager.clear();
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();

        mockMvc.perform(get("/api/owners?size=" + PAGE_SIZE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(PAGE_SIZE))
                .andExpect(jsonPath("$.content[0].pets[0].visits[0].description").value("checkup"));

        assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(5);
    }

    private void persistOwnerWithAPetAndAVisit(PetType type) {
        Owner owner = persist(TestData.anOwner());
        Pet pet = TestData.aPet();
        pet.setType(type);
        owner.addPet(pet);
        persist(pet);
        Visit visit = new Visit();
        visit.setDate(LocalDate.now());
        visit.setDescription("checkup");
        pet.addVisit(visit);
        persist(visit);
    }

    private <T> T persist(T entity) {
        entityManager.persist(entity);
        return entity;
    }
}
