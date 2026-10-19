package victor.training.petclinic.rest;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
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
import victor.training.petclinic.rest.dto.VisitDto;
import victor.training.petclinic.rest.dto.VisitFieldsDto;

import java.time.LocalDate;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.containsString;
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
    private static final LocalDate BIRTH = LocalDate.of(2020, 3, 1);
    private static final LocalDate A_YEAR_AHEAD = LocalDate.now().plusYears(1);

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

    ObjectMapper mapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    int ownerId;
    int petId;

    @BeforeEach
    final void aPetBornOn2020_03_01() {
        Owner owner = ownerRepository.save(TestData.anOwner());
        Pet pet = TestData.aPet();
        pet.setBirthDate(BIRTH);
        pet.setOwner(owner);
        pet.setType(petTypeRepository.save(TestData.aPetType("donkey")));
        petRepository.save(pet);
        ownerId = owner.getId();
        petId = pet.getId();
    }

    @Test
    void bookingOnTheBirthDateIsAccepted() throws Exception {
        bookForOwner(BIRTH).andExpect(status().isCreated());
    }

    @Test
    void bookingExactlyAYearAheadIsAccepted() throws Exception {
        bookForOwner(A_YEAR_AHEAD).andExpect(status().isCreated());
    }

    @Test
    void bookingBeforeTheBirthIsRefused() throws Exception {
        bookForOwner(BIRTH.minusDays(1))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors", hasItem(containsString("2020-03-01"))));
    }

    @Test
    void bookingMoreThanAYearAheadIsRefused() throws Exception {
        bookForOwner(A_YEAR_AHEAD.plusDays(1))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors", hasItem(containsString(A_YEAR_AHEAD.toString()))));
    }

    @Test
    void bookingThroughTheVisitsEndpointIsRefusedToo() throws Exception {
        VisitDto visit = new VisitDto().setPetId(petId).setDate(LocalDate.of(9, 7, 20)).setDescription("checkup");

        mockMvc.perform(post("/api/visits")
                .content(mapper.writeValueAsString(visit))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().isBadRequest());
    }

    @Test
    void movingAVisitOutOfRangeIsRefused() throws Exception {
        Visit visit = new Visit();
        visit.setDescription("checkup");
        petRepository.findById(petId).orElseThrow().addVisit(visit);
        visitRepository.save(visit);
        VisitFieldsDto moved = new VisitFieldsDto().setDate(BIRTH.minusYears(1)).setDescription("checkup");

        mockMvc.perform(put("/api/visits/" + visit.getId())
                .content(mapper.writeValueAsString(moved))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().isBadRequest());
    }

    private ResultActions bookForOwner(LocalDate date) throws Exception {
        VisitFieldsDto visit = new VisitFieldsDto().setDate(date).setDescription("checkup");
        return mockMvc.perform(post("/api/owners/{ownerId}/pets/{petId}/visits", ownerId, petId)
                .content(mapper.writeValueAsString(visit))
                .contentType(MediaType.APPLICATION_JSON_VALUE));
    }
}
