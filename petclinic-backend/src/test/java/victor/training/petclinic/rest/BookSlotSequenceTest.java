package victor.training.petclinic.rest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import victor.training.petclinic.genseq.GenerateSequence;
import victor.training.petclinic.scheduling.SlotGenerator;
import victor.training.petclinic.tools.PrettyTestNames;

import java.time.LocalDate;
import java.util.Map;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static victor.training.petclinic.genseq.Rest.call;
import static victor.training.petclinic.genseq.Steps.and;
import static victor.training.petclinic.genseq.Steps.given;
import static victor.training.petclinic.genseq.Steps.then;
import static victor.training.petclinic.genseq.Steps.when;

/**
 * The booking journey the slot picker drives from the UI: read a vet's free slots for a day, claim
 * one, and watch it leave the free list. Not @Transactional, for the reason spelled out in
 * {@link AddVisitSequenceTest} — a test transaction would collapse the per-repository transactions
 * that make the diagram worth reading.
 */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = {"OWNER_ADMIN", "VET_ADMIN"})
@DisplayNameGeneration(PrettyTestNames.class)
@GenerateSequence
class BookSlotSequenceTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    SlotGenerator slotGenerator;

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void booksAFreeSlotWithAVet() throws Exception {
        given("the nightly job has laid out the bookable slots");
        slotGenerator.generateSlotsForHorizon();
        int vetId = firstVetId();
        LocalDate day = firstDayWithFreeSlots(vetId);

        when("the owner opens a vet's calendar for that day");
        JsonNode freeSlots = json(call(mockMvc, get("/api/vets/{vetId}/slots?date={date}", vetId, day))
                .andExpect(status().isOk()));
        int slotId = freeSlots.get(0).path("id").asInt();

        and("books the first free slot for their pet");
        int petId = firstPetId();
        call(mockMvc, post("/api/visits")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "petId", petId,
                        "timeSlotId", slotId,
                        "description", "Slot booking check"))))
                .andExpect(status().isCreated());

        then("the slot is gone from the vet's free list");
        JsonNode afterBooking = json(call(mockMvc, get("/api/vets/{vetId}/slots?date={date}", vetId, day))
                .andExpect(status().isOk()));
        assertThat(idsOf(afterBooking)).doesNotContain(slotId);

        and("a second attempt on the same slot is refused");
        call(mockMvc, post("/api/visits")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "petId", petId,
                        "timeSlotId", slotId,
                        "description", "Double booking attempt"))))
                .andExpect(status().isConflict());
    }

    private LocalDate firstDayWithFreeSlots(int vetId) throws Exception {
        for (int dayOffset = 0; dayOffset < SlotGenerator.HORIZON_DAYS; dayOffset++) {
            LocalDate day = LocalDate.now().plusDays(dayOffset);
            JsonNode slots = json(mockMvc.perform(get("/api/vets/{vetId}/slots?date={date}", vetId, day))
                    .andExpect(status().isOk()));
            if (!slots.isEmpty()) {
                return day;
            }
        }
        throw new AssertionError("No free slot in the whole horizon — did V9 stop seeding vet_schedules?");
    }

    private int firstVetId() throws Exception {
        return json(mockMvc.perform(get("/api/vets")).andExpect(status().isOk())).get(0).path("id").asInt();
    }

    private int firstPetId() throws Exception {
        JsonNode owners = json(mockMvc.perform(get("/api/owners")).andExpect(status().isOk()));
        return StreamSupport.stream(owners.spliterator(), false)
                .filter(owner -> !owner.path("pets").isEmpty())
                .findFirst()
                .orElseThrow(() -> new AssertionError("No owner with a pet in the seeded data"))
                .path("pets").get(0).path("id").asInt();
    }

    private java.util.List<Integer> idsOf(JsonNode slots) {
        return StreamSupport.stream(slots.spliterator(), false).map(slot -> slot.path("id").asInt()).toList();
    }

    private JsonNode json(ResultActions response) throws Exception {
        return mapper.readTree(response.andReturn().getResponse().getContentAsString());
    }
}
