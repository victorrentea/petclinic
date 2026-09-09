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
import java.util.stream.StreamSupport;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.DisplayNameGeneration;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
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
// The diagram lays its sections out in the order the tests ran, so without a pinned order the
// picture is JUnit's arbitrary method order — and adding a test reshuffles every section, which
// the differ can only report as a rewrite. @Order makes the diagram read the way this file does.
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@GenerateSequence
class AddVisitSequenceTest {

    private static final String VISIT_DATE = "2026-05-12";

    @Autowired
    MockMvc mockMvc;

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    @Order(1)
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
        JsonNode owners = json(call(mockMvc, get("/api/owners")).andExpect(status().isOk()));
        return StreamSupport.stream(owners.spliterator(), false)
                .filter(o -> !o.path("pets").isEmpty())
                .findFirst()
                .orElseThrow(() -> new AssertionError(
                        "No owner with a pet in the seeded data — did V3__sample_data.sql change?"));
    }

    /**
     * The branch's own feature, one layer below the browser: the same journey as the
     * "Add a visit attended by a vet" scenario in add-visit.spec.ts and the
     * "A visit remembers the vet who attended it" scenario in add-visit.feature.
     * <p>
     * Its whole point on the diagram is the extra boundary crossing the vet link costs —
     * a GET /api/vets to populate the dropdown, a vetId travelling on the POST, and the
     * lookup that resolves it before the visit is saved. That is what the delta beside
     * this file draws in green, and none of it is visible from the unit tests.
     * <p>
     * VET_ADMIN alongside OWNER_ADMIN because the vet list is behind it: the receptionist
     * booking the visit is exactly the user who has to be allowed to read /api/vets, so a
     * test that skipped the list would also skip the authorisation question it raises.
     */
    @Test
    @Order(2)
    @WithMockUser(roles = {"OWNER_ADMIN", "VET_ADMIN"})
    void remembersTheVetWhoAttendedIt() throws Exception {
        given("an owner with at least one pet exists");
        JsonNode owner = anOwnerWithAPet();
        int ownerId = owner.path("id").asInt();
        int petId = owner.path("pets").get(0).path("id").asInt();

        and("the clinic has a vet who can attend it");
        JsonNode vet = theFirstVet();
        int vetId = vet.path("id").asInt();
        String vetName = vet.path("firstName").asText() + " " + vet.path("lastName").asText();

        when("a visit is booked for that pet with that vet attending");
        String description = "Annual check-up " + System.currentTimeMillis();
        call(mockMvc, post("/api/owners/{ownerId}/pets/{petId}/visits", ownerId, petId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(
                        Map.of("date", VISIT_DATE, "description", description, "vetId", vetId))))
                .andExpect(status().isCreated());

        then("that pet's history shows the visit was attended by that vet");
        JsonNode reloaded = json(call(mockMvc, get("/api/owners/{ownerId}", ownerId))
                .andExpect(status().isOk()));
        JsonNode visit = visitDescribed(reloaded, description);
        // The name, not only the id: the id proves the column was written, the two names
        // prove the read path joins the vet back in — which is the half the UI depends on.
        assertThat(visit.path("vetId").asInt()).isEqualTo(vetId);
        assertThat(visit.path("vetFirstName").asText() + " " + visit.path("vetLastName").asText())
                .isEqualTo(vetName);
    }

    /** The Java twin of the spec's `select_first_vet_in_visit_form`, over the list the dropdown loads. */
    private JsonNode theFirstVet() throws Exception {
        JsonNode vets = json(call(mockMvc, get("/api/vets")).andExpect(status().isOk()));
        assertThat(vets).as("the seeded vets").isNotEmpty();
        return vets.get(0);
    }

    /** The one visit this scenario booked — never `visits[0]`, whose position the seed data owns. */
    private JsonNode visitDescribed(JsonNode owner, String description) {
        return StreamSupport.stream(owner.path("pets").get(0).path("visits").spliterator(), false)
                .filter(v -> description.equals(v.path("description").asText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("The visit just booked is not in the pet's history"));
    }

    private JsonNode json(ResultActions response) throws Exception {
        return mapper.readTree(response.andReturn().getResponse().getContentAsString());
    }
}
