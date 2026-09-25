package victor.training.petclinic.rest;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.transaction.Transactional;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.convention.TestBean;
import org.springframework.test.web.servlet.MockMvc;
import victor.training.petclinic.repository.VisitRepository;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class VisitDateRangeTest {
    private static final int MILTON = 3;
    private static final int MILTON_OWNER = 3;

    @TestBean
    Clock clock;

    static Clock clock() {
        return Clock.fixed(Instant.parse("2026-09-10T12:00:00Z"), ZoneOffset.UTC);
    }

    @Autowired
    MockMvc mockMvc;

    @Autowired
    VisitRepository visitRepository;

    @ParameterizedTest
    @CsvSource({
            "0009-07-20, 400",
            "2020-09-06, 400",
            "2020-09-07, 201",
            "2027-09-10, 201",
            "2027-09-11, 400",
    })
    void addVisit(String date, int expectedStatus) throws Exception {
        mockMvc.perform(post("/api/visits").contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"date": "%s", "description": "check-up", "petId": %d}""".formatted(date, MILTON)))
                .andExpect(status().is(expectedStatus));
    }

    @ParameterizedTest
    @CsvSource({"2020-09-06", "2027-09-11"})
    void addVisitToOwnersPet_refusesADateOutOfRange(String date) throws Exception {
        mockMvc.perform(post("/api/owners/{ownerId}/pets/{petId}/visits", MILTON_OWNER, MILTON)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"date": "%s", "description": "check-up"}""".formatted(date)))
                .andExpect(status().isBadRequest());
    }

    @ParameterizedTest
    @CsvSource({"2020-09-06", "2027-09-11"})
    void updateVisit_refusesADateOutOfRange(String date) throws Exception {
        int visitId = visitRepository.findByPetId(MILTON).get(0).getId();

        mockMvc.perform(put("/api/visits/{visitId}", visitId).contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"date": "%s", "description": "check-up"}""".formatted(date)))
                .andExpect(status().isBadRequest());
    }
}
