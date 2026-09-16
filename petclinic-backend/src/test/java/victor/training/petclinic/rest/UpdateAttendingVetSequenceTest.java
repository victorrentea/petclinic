package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static victor.training.petclinic.genseq.Rest.call;
import static victor.training.petclinic.genseq.Steps.and;
import static victor.training.petclinic.genseq.Steps.given;
import static victor.training.petclinic.genseq.Steps.then;
import static victor.training.petclinic.genseq.Steps.when;

import java.util.Map;
import java.util.stream.StreamSupport;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
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

import victor.training.petclinic.genseq.GenerateSequence;
import victor.training.petclinic.tools.PrettyTestNames;

/**
 * The API-only twin of {@link VisitTest#update_changesTheAttendingVet}, one layer down: no
 * Chromium, no Angular, no running server — just the picture this PR's "link a visit with a vet"
 * change is actually about (UpdateAttendingVetSequenceTest.java.genseq.puml, drawn beside this
 * file).
 * <p>
 * Put next to the other REST tests on purpose, exactly like {@link AddVisitSequenceTest}: the
 * claim is that any @SpringBootTest here becomes a sequence diagram by adding one annotation and
 * saying its sentences out loud.
 * <p>
 * Deliberately NOT @Transactional, for the same reason as {@link AddVisitSequenceTest}: a test
 * transaction wrapped round the MockMvc calls would swallow the repository-level transactions and
 * collapse the diagram's DB frames — the two updateVisit()/resolveVet() round-trips that make the
 * picture worth reading — into one box.
 */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@DisplayNameGeneration(PrettyTestNames.class)
class UpdateAttendingVetSequenceTest {

    @Autowired
    MockMvc mockMvc;

    private final ObjectMapper mapper = new ObjectMapper();

    // On the method, like its Gherkin twin tags a scenario and not a feature file.
    @GenerateSequence
    @Test
    void changesTheAttendingVetOnAVisit() throws Exception {
        given("a visit exists");
        JsonNode visit = anExistingVisit();
        int visitId = visit.path("id").asInt();
        int previousVetId = visit.path("vetId").asInt(-1);

        and("a vet other than the current one is available");
        int vetId = anExistingVetId(previousVetId);

        when("the visit is re-assigned to that vet");
        call(mockMvc, put("/api/visits/{visitId}", visitId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "date", visit.path("date").asText(),
                        "description", visit.path("description").asText(),
                        "vetId", vetId))))
                .andExpect(status().isOk());

        then("the visit shows the new attending vet");
        JsonNode reloaded = json(call(mockMvc, get("/api/visits/{visitId}", visitId))
                .andExpect(status().isOk()));
        assertThat(reloaded.path("vetId").asInt()).isEqualTo(vetId);
    }

    private JsonNode anExistingVisit() throws Exception {
        JsonNode visits = json(call(mockMvc, get("/api/visits")).andExpect(status().isOk()));
        return StreamSupport.stream(visits.spliterator(), false)
                .findFirst()
                .orElseThrow(() -> new AssertionError(
                        "No visit in the seeded data — did db/seed/R__seed.sql change?"));
    }

    private int anExistingVetId(int excluding) throws Exception {
        JsonNode vets = json(call(mockMvc, get("/api/vets")).andExpect(status().isOk()));
        return StreamSupport.stream(vets.spliterator(), false)
                .map(v -> v.path("id").asInt())
                .filter(id -> id != excluding)
                .findFirst()
                .orElseThrow(() -> new AssertionError("Need at least two vets in the seeded data"));
    }

    private JsonNode json(ResultActions response) throws Exception {
        return mapper.readTree(response.andReturn().getResponse().getContentAsString());
    }
}
