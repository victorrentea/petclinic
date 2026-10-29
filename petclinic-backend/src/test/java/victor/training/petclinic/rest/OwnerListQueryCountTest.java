package victor.training.petclinic.rest;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.PetType;
import victor.training.petclinic.domain.Visit;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.PetTypeRepository;
import victor.training.petclinic.repository.VisitRepository;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** A page of owners costs the same few queries however many owners, pets and visits there are (#25). */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
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
    void aPageOfTwentyOwnersWithPetsAndVisitsTakesFourQueries() throws Exception {
        PetType cat = petTypeRepository.findById(1).orElseThrow();
        for (int i = 0; i < 25; i++) {
            Owner owner = ownerRepository.save(TestData.anOwner());
            for (int p = 0; p < 2; p++) {
                Pet pet = TestData.aPet();
                pet.setType(cat);
                pet.setOwner(owner);
                Visit visit = new Visit();
                visit.setDate(LocalDate.now());
                visit.setDescription("Check-up");
                visit.setPet(petRepository.save(pet));
                visitRepository.save(visit);
            }
        }
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();

        mockMvc.perform(get("/api/owners?size=20")).andExpect(status().isOk());

        assertThat(statistics.getPrepareStatementCount())
                .as("the page, the count, its pets, their visits")
                .isLessThanOrEqualTo(4);
    }
}
