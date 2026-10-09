package victor.training.petclinic.rest;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.hamcrest.Matchers.containsString;

import java.time.LocalDate;
import java.util.Map;

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

import com.fasterxml.jackson.databind.ObjectMapper;

import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.Visit;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.PetTypeRepository;
import victor.training.petclinic.repository.VisitRepository;

/** Issue #40: a visit is dated between the pet's birth and one year from today. */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class VisitDateRangeTest {
    private static final LocalDate BIRTH = PetTest.BIRTH_DATE;
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

    private final ObjectMapper mapper = new ObjectMapper();
    int ownerId;
    int petId;
    int visitId;

    @BeforeEach
    void aPetWithAVisit() {
        Owner owner = ownerRepository.save(TestData.anOwner());
        Pet pet = TestData.aPet();
        pet.setOwner(owner);
        pet.setType(petTypeRepository.save(TestData.aPetType("dog")));
        petRepository.save(pet);
        Visit visit = new Visit();
        visit.setDate(BIRTH.plusDays(1));
        visit.setDescription("first shots");
        pet.addVisit(visit);
        visitRepository.save(visit);
        ownerId = owner.getId();
        petId = pet.getId();
        visitId = visit.getId();
    }

    @Test
    void bookingOnThePetsBirthDayIsAccepted() throws Exception {
        book(BIRTH).andExpect(status().isCreated());
    }

    @Test
    void bookingBeforeThePetsBirthIsRefused() throws Exception {
        book(BIRTH.minusDays(1))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail", containsString("before Leo's birth date " + BIRTH)));
    }

    @Test
    void bookingInTheYear9IsRefused() throws Exception {
        book(LocalDate.of(9, 7, 20)).andExpect(status().isBadRequest());
    }

    @Test
    void bookingExactlyOneYearAheadIsAccepted() throws Exception {
        book(LATEST).andExpect(status().isCreated());
    }

    @Test
    void bookingMoreThanOneYearAheadIsRefused() throws Exception {
        book(LATEST.plusDays(1))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail", containsString("more than one year ahead")));
    }

    @Test
    void addingThroughTheVisitsEndpointIsCheckedToo() throws Exception {
        mockMvc.perform(post("/api/visits").contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("date", BIRTH.minusDays(1).toString(), "description", "x", "petId", petId))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void movingAVisitBeforeThePetsBirthIsRefused() throws Exception {
        mockMvc.perform(put("/api/visits/{visitId}", visitId).contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("date", BIRTH.minusDays(1).toString(), "description", "x"))))
                .andExpect(status().isBadRequest());
    }

    private ResultActions book(LocalDate date) throws Exception {
        return mockMvc.perform(post("/api/owners/{ownerId}/pets/{petId}/visits", ownerId, petId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("date", date.toString(), "description", "check-up"))));
    }

    private String json(Map<String, ?> body) throws Exception {
        return mapper.writeValueAsString(body);
    }
}
