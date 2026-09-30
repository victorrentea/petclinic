package victor.training.petclinic.rest;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** Issue #40: a visit is dated between the pet's birth and one year from today. */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class VisitDateRangeTest {
    private static final int KEVIN = 1;
    private static final int AXEL = 1; // born 2018-12-24
    private static final LocalDate AXEL_BIRTH = LocalDate.parse("2018-12-24");

    @Autowired
    MockMvc mockMvc;

    @Test
    void refusesAVisitInTheYear0009() throws Exception {
        bookForAxel(LocalDate.parse("0009-07-20"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(containsString("cannot predate the pet's birth (2018-12-24)")));
    }

    @Test
    void refusesAVisitTheDayBeforeThePetWasBorn() throws Exception {
        bookForAxel(AXEL_BIRTH.minusDays(1)).andExpect(status().isBadRequest());
    }

    @Test
    void acceptsAVisitOnThePetsBirthday() throws Exception {
        bookForAxel(AXEL_BIRTH).andExpect(status().isCreated());
    }

    @Test
    void refusesAVisitMoreThanAYearAhead() throws Exception {
        bookForAxel(LocalDate.now().plusYears(1).plusDays(1))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(containsString("more than a year ahead")));
    }

    @Test
    void acceptsAVisitExactlyAYearAhead() throws Exception {
        bookForAxel(LocalDate.now().plusYears(1)).andExpect(status().isCreated());
    }

    @Test
    void refusesTheSameDateThroughTheVisitsEndpoint() throws Exception {
        String visit = """
                {"petId": %d, "date": "0009-07-20", "description": "check-up"}""".formatted(AXEL);
        send(post("/api/visits"), visit).andExpect(status().isBadRequest());
    }

    @Test
    void refusesMovingAnExistingVisitOutOfRange() throws Exception {
        String location = bookForAxel(AXEL_BIRTH).andReturn().getResponse().getHeader("Location");
        int visitId = Integer.parseInt(location.substring(location.lastIndexOf('/') + 1));

        send(put("/api/visits/{id}", visitId), fields(LocalDate.parse("0009-07-20")))
                .andExpect(status().isBadRequest());
    }

    private ResultActions bookForAxel(LocalDate date) throws Exception {
        return send(post("/api/owners/{ownerId}/pets/{petId}/visits", KEVIN, AXEL), fields(date));
    }

    private static String fields(LocalDate date) {
        return """
                {"date": "%s", "description": "check-up"}""".formatted(date);
    }

    private ResultActions send(MockHttpServletRequestBuilder request, String json) throws Exception {
        return mockMvc.perform(request.contentType(MediaType.APPLICATION_JSON).content(json));
    }
}
