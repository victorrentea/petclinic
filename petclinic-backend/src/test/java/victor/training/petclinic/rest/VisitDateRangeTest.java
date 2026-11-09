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
import org.springframework.test.web.servlet.ResultMatcher;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.Visit;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.PetTypeRepository;
import victor.training.petclinic.repository.VisitRepository;

import java.time.LocalDate;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Issue #40: a visit is dated between the pet's birth and one year from today, on every write. */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class VisitDateRangeTest {
    private static final LocalDate BIRTH = LocalDate.of(2024, 5, 10);
    private static final LocalDate LATEST = LocalDate.now().plusYears(1);

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
    int visitId;

    @BeforeEach
    void axelBornOnBirth() {
        Owner owner = ownerRepository.save(TestData.anOwner());
        Pet pet = TestData.aPet();
        pet.setBirthDate(BIRTH);
        pet.setOwner(owner);
        pet.setType(petTypeRepository.save(TestData.aPetType("dog")));
        petRepository.save(pet);
        Visit visit = new Visit();
        visit.setDescription("rabies shot");
        pet.addVisit(visit);
        visitRepository.save(visit);
        ownerId = owner.getId();
        petId = pet.getId();
        visitId = visit.getId();
    }

    @Test
    void bookingBeforeBirth_isRefused() throws Exception {
        bookOnOwnersPet(BIRTH.minusDays(1), status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("A visit can't predate the pet's birth (2024-05-10)"));
    }

    @Test
    void bookingOnBirthDay_isAccepted() throws Exception {
        bookOnOwnersPet(BIRTH, status().isCreated());
    }

    @Test
    void bookingMoreThanAYearAhead_isRefused() throws Exception {
        bookOnOwnersPet(LATEST.plusDays(1), status().isBadRequest())
                .andExpect(jsonPath("$.detail")
                        .value("A visit can be booked at most one year ahead (" + LATEST + ")"));
    }

    @Test
    void bookingExactlyAYearAhead_isAccepted() throws Exception {
        bookOnOwnersPet(LATEST, status().isCreated());
    }

    @Test
    void addingThroughVisitsEndpoint_beforeBirth_isRefused() throws Exception {
        mockMvc.perform(post("/api/visits").contentType(MediaType.APPLICATION_JSON)
                .content(json(BIRTH.minusDays(1)).replace("{", "{\"petId\":" + petId + ",")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void updatingToTheYearNine_isRefused() throws Exception {
        mockMvc.perform(put("/api/visits/{id}", visitId).contentType(MediaType.APPLICATION_JSON)
                .content(json(LocalDate.of(9, 7, 20))))
                .andExpect(status().isBadRequest());
    }

    private ResultActions bookOnOwnersPet(LocalDate date, ResultMatcher expected)
            throws Exception {
        return mockMvc.perform(post("/api/owners/{o}/pets/{p}/visits", ownerId, petId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(date)))
                .andExpect(expected);
    }

    private static String json(LocalDate date) {
        return "{\"date\":\"" + date + "\",\"description\":\"ate the Christmas tinsel\"}";
    }
}
