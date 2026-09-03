package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static victor.training.petclinic.genseq.Rest.call;
import static victor.training.petclinic.genseq.Steps.and;
import static victor.training.petclinic.genseq.Steps.given;
import static victor.training.petclinic.genseq.Steps.then;
import static victor.training.petclinic.genseq.Steps.when;

import java.util.Map;

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
 * The same journey as petclinic-test/src/add-visit.spec.ts, one layer down: no Chromium, no Angular,
 * no running server — and the same picture out the other end
 * (AddVisitSequenceTest.java.genseq.puml, drawn beside this file).
 * <p>
 * Put next to the other REST tests on purpose. The claim being made is that any @SpringBootTest here
 * becomes a sequence diagram by adding one annotation and saying its sentences out loud; a demo
 * living in a folder of its own would be a claim about the demo.
 * <p>
 * Deliberately NOT @Transactional, unlike its neighbours: a test transaction wrapped round the
 * MockMvc calls would swallow the repository-level transactions, and the frames that make the
 * diagram worth reading — one transaction and one Hibernate session per repository call, with the
 * lazy loads of the N+1 falling outside every one of them — would vanish into a single box. What is
 * left behind is a row in an embedded database that is thrown away with the JVM.
 */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@DisplayNameGeneration(PrettyTestNames.class)
@GenerateSequence
class AddVisitSequenceTest {

    private static final String VISIT_DATE = "2026-05-12";

    @Autowired
    MockMvc mockMvc;

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void addsAVisitToAnExistingPet() throws Exception {
        given("an owner with at least one pet exists");
        JsonNode owner = anOwnerWithAPet();
        int ownerId = owner.path("id").asInt();
        int petId = owner.path("pets").get(0).path("id").asInt();

        when("the owner detail page is opened");
        call(mockMvc, get("/api/owners/{ownerId}", ownerId)).andExpect(status().isOk());

        and("a visit is added for the first pet");
        String description = "Annual check-up " + System.currentTimeMillis();
        call(mockMvc, post("/api/owners/{ownerId}/pets/{petId}/visits", ownerId, petId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("date", VISIT_DATE, "description", description))))
                .andExpect(status().isCreated());

        then("the visit is listed under the pet");
        JsonNode reloaded = json(call(mockMvc, get("/api/owners/{ownerId}", ownerId))
                .andExpect(status().isOk()));
        assertThat(reloaded.path("pets").get(0).path("visits").toString())
                .contains(description)
                .contains(VISIT_DATE);
    }

    /**
     * The Java twin of the spec's `an_owner_with_at_least_one_pet_exists`, over MockMvc instead of axios.
     * {@link victor.training.petclinic.genseq.Rest#call} rather than a bare `mockMvc.perform`: it
     * wraps the call in the span that carries the JSON payloads onto the diagram.
     */
    private JsonNode anOwnerWithAPet() throws Exception {
        // the grid pages over slim rows that carry no pets, so the detail endpoint answers "has a pet"
        JsonNode page = json(call(mockMvc, get("/api/owners")).andExpect(status().isOk()));
        for (JsonNode row : page.path("content")) {
            JsonNode owner = json(call(mockMvc, get("/api/owners/" + row.path("id").asInt()))
                    .andExpect(status().isOk()));
            if (!owner.path("pets").isEmpty()) {
                return owner;
            }
        }
        throw new AssertionError("No owner with a pet in the seeded data — did V3__sample_data.sql change?");
    }

    private JsonNode json(ResultActions response) throws Exception {
        return mapper.readTree(response.andReturn().getResponse().getContentAsString());
    }
}
