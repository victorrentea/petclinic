package victor.training.petclinic.rest;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.Map;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.ObjectMapper;

/** Issue #40: a visit is dated between the pet's birth and one year from today. */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = {"OWNER_ADMIN", "VET_ADMIN"})
class VisitDateRangeApiTest {
    private static final LocalDate AXEL_BORN = LocalDate.parse("2024-05-10");

    @Autowired
    MockMvc mockMvc;

    private final ObjectMapper mapper = new ObjectMapper();
    private int ownerId;
    private int axelId;

    @BeforeEach
    void kevinOwnsAxel() throws Exception {
        ownerId = createdId(post("/api/owners"), Map.of("firstName", "Kevin", "lastName", "McCallister",
                "address", "671 Lincoln Ave", "city", "Winnetka", "telephone", "0712345678"));
        axelId = createdId(post("/api/owners/{ownerId}/pets", ownerId), Map.of("name", "Axel",
                "birthDate", AXEL_BORN.toString(), "type", Map.of("id", 2, "name", "dog")));
    }

    @Test
    void aVisitBeforeThePetsBirthIsRefused() throws Exception {
        bookVisit(LocalDate.parse("0009-07-20")).andExpect(status().isBadRequest());
    }

    @Test
    void aVisitMoreThanOneYearAheadIsRefused() throws Exception {
        bookVisit(LocalDate.now().plusYears(1).plusDays(1)).andExpect(status().isBadRequest());
    }

    @Test
    void aVisitOnTheBoundariesIsBooked() throws Exception {
        bookVisit(AXEL_BORN).andExpect(status().isCreated());
        bookVisit(LocalDate.now().plusYears(1)).andExpect(status().isCreated());
    }

    @Test
    void aVisitCannotBeMovedBeforeThePetsBirth() throws Exception {
        String location = bookVisit(AXEL_BORN).andReturn().getResponse().getHeader("Location");
        int visitId = Integer.parseInt(location.substring(location.lastIndexOf('/') + 1));

        mockMvc.perform(json(put("/api/visits/{visitId}", visitId),
                Map.of("date", "0009-07-20", "description", "moved")))
                .andExpect(status().isBadRequest());
    }

    private ResultActions bookVisit(LocalDate date) throws Exception {
        return mockMvc.perform(json(post("/api/owners/{ownerId}/pets/{petId}/visits", ownerId, axelId),
                Map.of("date", date.toString(), "description", "ate the Christmas tinsel")));
    }

    private int createdId(MockHttpServletRequestBuilder request, Map<String, ?> body) throws Exception {
        String location = mockMvc.perform(json(request, body))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getHeader("Location");
        return Integer.parseInt(location.substring(location.lastIndexOf('/') + 1));
    }

    private MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder request, Map<String, ?> body)
            throws Exception {
        return request.contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body));
    }
}
