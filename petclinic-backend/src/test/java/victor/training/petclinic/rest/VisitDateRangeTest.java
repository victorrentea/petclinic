package victor.training.petclinic.rest;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.Visit;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.PetTypeRepository;
import victor.training.petclinic.repository.VisitRepository;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Issue #40: every API write of a visit date keeps it between the pet's birth and one year from today. */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class VisitDateRangeTest {
    static final LocalDate BIRTH = LocalDate.parse("2024-05-10");

    @Autowired
    MockMvc mockMvc;
    @Autowired
    OwnerRepository ownerRepository;
    @Autowired
    PetRepository petRepository;
    @Autowired
    PetTypeRepository petTypeRepository;
    @Autowired
    VisitRepository visitRepository;

    int ownerId;
    int petId;

    @BeforeEach
    final void before() {
        Owner owner = ownerRepository.save(TestData.anOwner());
        Pet pet = TestData.aPet();
        pet.setBirthDate(BIRTH);
        pet.setOwner(owner);
        pet.setType(petTypeRepository.save(TestData.aPetType("dog")));
        petRepository.save(pet);
        ownerId = owner.getId();
        petId = pet.getId();
    }

    @Test
    void bookingBeforeTheBirthIsRefused() throws Exception {
        bookOnOwnersPet("0009-07-20")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0]").value(
                        "Visit date 0009-07-20 is before Leo was born (2024-05-10)"));
        assertThat(visitRepository.findByPetId(petId)).isEmpty();
    }

    @Test
    void bookingOnTheBirthDayIsAccepted() throws Exception {
        bookOnOwnersPet(BIRTH.toString()).andExpect(status().isCreated());
    }

    @Test
    void bookingMoreThanAYearAheadIsRefused() throws Exception {
        bookOnOwnersPet(LocalDate.now().plusYears(1).plusDays(1).toString())
                .andExpect(status().isBadRequest());
    }

    @Test
    void bookingExactlyAYearAheadIsAccepted() throws Exception {
        bookOnOwnersPet(LocalDate.now().plusYears(1).toString()).andExpect(status().isCreated());
    }

    @Test
    void postingAVisitBeforeTheBirthIsRefused() throws Exception {
        mockMvc.perform(post("/api/visits").contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"date": "0009-07-20", "description": "ate the tinsel", "petId": %d}
                        """.formatted(petId)))
                .andExpect(status().isBadRequest());
        assertThat(visitRepository.findByPetId(petId)).isEmpty();
    }

    @Test
    void movingAVisitBeforeTheBirthIsRefused() throws Exception {
        Visit visit = new Visit();
        visit.setDescription("rabies shot");
        petRepository.findById(petId).orElseThrow().addVisit(visit);
        visitRepository.save(visit);

        mockMvc.perform(put("/api/visits/{id}", visit.getId()).contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"date": "0009-07-20", "description": "rabies shot"}
                        """))
                .andExpect(status().isBadRequest());
    }

    private ResultActions bookOnOwnersPet(String date) throws Exception {
        return mockMvc.perform(post("/api/owners/{ownerId}/pets/{petId}/visits", ownerId, petId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"date": "%s", "description": "ate the Christmas tinsel"}
                        """.formatted(date)));
    }
}
