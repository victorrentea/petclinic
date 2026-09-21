package victor.training.petclinic.rest;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.hamcrest.Matchers.containsString;

import java.time.LocalDate;
import java.util.Map;
import java.util.stream.StreamSupport;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayNameGeneration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import victor.training.petclinic.tools.PrettyTestNames;

/**
 * Issue #40 at the API, where it has to hold: the form is one client of three write paths, and
 * a rule enforced only in Angular is a rule anything with curl can walk past.
 * <p>
 * The dates are computed from the real clock because the upper bound is "one year from today";
 * the pet's birth date comes from the pet the test creates, so the lower bound is exact. The
 * boundary cases (the birth day itself, exactly a year out) are here too — an over-eager fix
 * that refuses them is as broken as no fix.
 */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@DisplayNameGeneration(PrettyTestNames.class)
class VisitDateRangeApiTest {

    private static final int PET_AGE_DAYS = 2_000;

    @Autowired
    MockMvc mockMvc;

    private final ObjectMapper mapper = new ObjectMapper();

    private int ownerId;
    private int petId;
    private LocalDate bornOn;

    @BeforeEach
    void createAPetWithAKnownBirthDate() throws Exception {
        bornOn = LocalDate.now().minusDays(PET_AGE_DAYS);
        ownerId = json(mockMvc.perform(get("/api/owners")).andExpect(status().isOk()))
                .path("content").get(0).path("id").asInt();
        JsonNode petType = json(mockMvc.perform(get("/api/pettypes")).andExpect(status().isOk())).get(0);

        mockMvc.perform(post("/api/owners/{ownerId}/pets", ownerId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "name", "DateRangeFixture", "birthDate", bornOn.toString(), "type", petType))))
                .andExpect(status().isCreated());

        JsonNode owner = json(mockMvc.perform(get("/api/owners/{ownerId}", ownerId)).andExpect(status().isOk()));
        petId = StreamSupport.stream(owner.path("pets").spliterator(), false)
                .filter(p -> "DateRangeFixture".equals(p.path("name").asText()))
                .reduce((first, second) -> second)
                .orElseThrow(() -> new AssertionError("The pet just created is not under its owner"))
                .path("id").asInt();
    }

    @Test
    void refusesAVisitDatedBeforeThePetWasBorn() throws Exception {
        bookAtVisitsEndpoint(bornOn.minusDays(1))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(containsString("birth date")));
    }

    @Test
    void refusesAVisitMoreThanOneYearAhead() throws Exception {
        bookAtVisitsEndpoint(LocalDate.now().plusYears(1).plusDays(1))
                .andExpect(status().isBadRequest());
    }

    @Test
    void acceptsAVisitOnThePetsBirthDay() throws Exception {
        bookAtVisitsEndpoint(bornOn).andExpect(status().isCreated());
    }

    @Test
    void acceptsAVisitExactlyOneYearAhead() throws Exception {
        bookAtVisitsEndpoint(LocalDate.now().plusYears(1)).andExpect(status().isCreated());
    }

    @Test
    void refusesAnOutOfRangeVisitBookedUnderTheOwnerToo() throws Exception {
        mockMvc.perform(post("/api/owners/{ownerId}/pets/{petId}/visits", ownerId, petId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "date", bornOn.minusYears(5).toString(), "description", "Before the pet existed"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void refusesMovingAnExistingVisitOutOfRange() throws Exception {
        String location = bookAtVisitsEndpoint(bornOn.plusDays(1))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getHeader("Location");
        String visitId = location.substring(location.lastIndexOf('/') + 1);

        mockMvc.perform(put("/api/visits/{visitId}", visitId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "date", "0009-07-20", "description", "Edited into the year 9"))))
                .andExpect(status().isBadRequest());
    }

    private ResultActions bookAtVisitsEndpoint(LocalDate date) throws Exception {
        return mockMvc.perform(post("/api/visits")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "petId", petId, "date", date.toString(), "description", "Date range check"))));
    }

    private JsonNode json(ResultActions response) throws Exception {
        return mapper.readTree(response.andReturn().getResponse().getContentAsString());
    }
}
