package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
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
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import jakarta.transaction.Transactional;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.PetType;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.PetTypeRepository;

/** Guards @BatchSize on Owner.pets: a page of owners costs the same few statements, whatever its size. */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerListQueryCountTest {

    @Autowired
    MockMvc mockMvc;
    @Autowired
    OwnerRepository ownerRepository;
    @Autowired
    PetRepository petRepository;
    @Autowired
    PetTypeRepository petTypeRepository;
    @Autowired
    EntityManager entityManager;
    @Autowired
    EntityManagerFactory entityManagerFactory;

    @Test
    void aPageOfTwentyOwnersWithPets_takesAtMostThreeStatements() throws Exception {
        PetType type = petTypeRepository.save(TestData.aPetType("zpgtype"));
        for (int i = 0; i < 20; i++) {
            Owner owner = TestData.anOwner();
            owner.setLastName("Zpg" + (char) ('a' + i));
            Pet pet = TestData.aPet();
            pet.setType(type);
            owner.addPet(pet);
            ownerRepository.save(owner);
            petRepository.save(pet);
        }
        entityManager.flush();
        entityManager.clear(); // otherwise the pets come from this persistence context, not from SQL
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();

        mockMvc.perform(get("/api/owners?lastName=Zpg&size=20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(20))
                .andExpect(jsonPath("$.content[19].petNames[0]").value("Leo"));

        assertThat(statistics.getPrepareStatementCount())
                .as("owners page + count + one batch of pets")
                .isLessThanOrEqualTo(3);
    }
}
