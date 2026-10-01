package victor.training.petclinic.rest;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.fasterxml.jackson.databind.ObjectMapper;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.transaction.Transactional;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.Visit;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.PetTypeRepository;
import victor.training.petclinic.repository.VisitRepository;

/**
 * Issue #40, the backend half of petclinic-test/src/visit-date-range.feature: same today, same pet,
 * same dates — against every endpoint that writes a visit date, since the form is not the only client.
 */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class VisitDateRangeTest {

    static final LocalDate TODAY = LocalDate.parse("2026-09-10");
    static final LocalDate BIRTH_DATE = LocalDate.parse("2020-03-01");

    @TestConfiguration
    static class FixedToday {
        @Bean
        @Primary
        Clock fixedClock() {
            ZoneId zone = ZoneId.systemDefault();
            return Clock.fixed(TODAY.atStartOfDay(zone).toInstant(), zone);
        }
    }

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

    final ObjectMapper mapper = new ObjectMapper();
    int ownerId;
    int petId;
    int visitId;

    @BeforeEach
    void aPetBornOn20200301() {
        Owner owner = ownerRepository.save(TestData.anOwner());
        Pet pet = TestData.aPet();
        pet.setBirthDate(BIRTH_DATE);
        owner.addPet(pet);
        pet.setType(petTypeRepository.save(TestData.aPetType("dog")));
        petRepository.save(pet);
        Visit visit = new Visit();
        visit.setDescription("checkup");
        pet.addVisit(visit);
        visitRepository.save(visit);
        ownerId = owner.getId();
        petId = pet.getId();
        visitId = visit.getId();
    }

    @ParameterizedTest
    @ValueSource(strings = {"2020-02-29", "2027-09-11", "0009-07-20"})
    void refusesToBookOutOfRange(String date) throws Exception {
        bookFromOwnerPage(date)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(containsString(date)));
    }

    @ParameterizedTest
    @ValueSource(strings = {"2020-03-01", "2027-09-10"})
    void booksOnTheEdgesOfTheRange(String date) throws Exception {
        bookFromOwnerPage(date).andExpect(status().isCreated());
    }

    @Test
    void refusesToBookOutOfRangeViaVisitsEndpoint() throws Exception {
        mockMvc.perform(post("/api/visits")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("petId", petId, "date", "2020-02-29", "description", "too early"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void refusesToMoveAVisitOutOfRange() throws Exception {
        mockMvc.perform(put("/api/visits/{visitId}", visitId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("date", "2027-09-11", "description", "too late"))))
                .andExpect(status().isBadRequest());
    }

    private ResultActions bookFromOwnerPage(String date) throws Exception {
        return mockMvc.perform(post("/api/owners/{ownerId}/pets/{petId}/visits", ownerId, petId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("date", date, "description", "a visit"))));
    }

    private String json(Map<String, Object> body) throws Exception {
        return mapper.writeValueAsString(body);
    }
}
