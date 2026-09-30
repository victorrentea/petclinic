package victor.training.petclinic.rest;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import jakarta.transaction.Transactional;
import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.Vet;
import victor.training.petclinic.domain.Visit;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.PetTypeRepository;
import victor.training.petclinic.repository.VetRepository;
import victor.training.petclinic.repository.VisitRepository;
import victor.training.petclinic.rest.dto.VisitDto;
import victor.training.petclinic.rest.dto.VisitFieldsDto;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
public class VisitTest {

    @Autowired
    MockMvc mockMvc;

    ObjectMapper mapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    @Autowired
    VisitRepository visitRepository;

    @Autowired
    PetRepository petRepository;

    @Autowired
    OwnerRepository ownerRepository;

    @Autowired
    VetRepository vetRepository;

    int visitId;
    int petId;
    int ownerId;
    int vetId;
    @Autowired
    private PetTypeRepository petTypeRepository;

    @BeforeEach
    final void before() {
        Owner owner = ownerRepository.save(TestData.anOwner());
        ownerId = owner.getId();
        Pet pet = TestData.aPet();
        pet.setOwner(owner);
        pet.setType(petTypeRepository.save(TestData.aPetType("dog")));
        petRepository.save(pet);
        petId = pet.getId();

        Vet vet = TestData.aVet("Helen", "Leary");
        vetRepository.save(vet);
        vetId = vet.getId();

        Visit visit = new Visit();
        visit.setDate(LocalDate.now());
        visit.setDescription("rabies shot");
        pet.addVisit(visit);
        visitRepository.save(visit);
        visitId = visit.getId();
    }

    private VisitDto callGet(int visitId) throws Exception {
        String responseJson = mockMvc.perform(get("/api/visits/" + visitId))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json"))
                .andReturn()
                .getResponse()
                .getContentAsString();
        return mapper.readValue(responseJson, VisitDto.class);
    }

    @Test
    void getByIdOk() throws Exception {
        VisitDto responseDto = callGet(visitId);

        assertThat(responseDto.getId()).isEqualTo(visitId);
        assertThat(responseDto.getDescription()).isEqualTo("rabies shot");
        assertThat(responseDto.getPetId()).isEqualTo(petId);
    }

    @Test
    void getById_notFound() throws Exception {
        mockMvc.perform(get("/api/visits/99999"))
                .andExpect(status().isNotFound());
    }

    @Test
    void getAll() throws Exception {
        String responseJson = mockMvc.perform(get("/api/visits"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json"))
                .andReturn()
                .getResponse()
                .getContentAsString();
        VisitDto[] visits = mapper.readValue(responseJson, VisitDto[].class);

        assertThat(visits)
                .extracting(VisitDto::getId, VisitDto::getDescription)
                .contains(Assertions.tuple(visitId, "rabies shot"));
    }

    @Test
    void getAll_returnsEnrichedFields() throws Exception {
        String responseJson = mockMvc.perform(get("/api/visits"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json"))
                .andReturn()
                .getResponse()
                .getContentAsString();
        VisitDto[] visits = mapper.readValue(responseJson, VisitDto[].class);

        VisitDto created = Arrays.stream(visits)
                .filter(v -> v.getId() == visitId)
                .findFirst()
                .orElseThrow();

        Owner owner = ownerRepository.findById(petRepository.findById(petId).orElseThrow().getOwner().getId())
                .orElseThrow();
        Pet pet = petRepository.findById(petId).orElseThrow();

        assertThat(created.getPetName()).isEqualTo(pet.getName());
        assertThat(created.getOwnerId()).isEqualTo(owner.getId());
        assertThat(created.getOwnerFirstName()).isEqualTo(owner.getFirstName());
        assertThat(created.getOwnerLastName()).isEqualTo(owner.getLastName());
    }

    @Test
    void create_invalid() throws Exception {
        VisitDto newVisit = new VisitDto()
                .setPetId(petId)
                .setDate(LocalDate.now());
        // missing description - validation error

        mockMvc.perform(post("/api/visits")
                .content(mapper.writeValueAsString(newVisit))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().isBadRequest());
    }

    @Test
    void update_invalid() throws Exception {
        VisitDto existing = callGet(visitId);
        existing.setDescription(null); // invalid description

        mockMvc.perform(put("/api/visits/" + visitId)
                .content(mapper.writeValueAsString(existing))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void delete_ok() throws Exception {
        mockMvc.perform(delete("/api/visits/" + visitId))
                .andExpect(status().is2xxSuccessful());

        mockMvc.perform(get("/api/visits/" + visitId))
                .andExpect(status().isNotFound());
    }

    @Test
    void delete_notFound() throws Exception {
        mockMvc.perform(delete("/api/visits/9999"))
                .andExpect(status().isNotFound());
    }

    @Test
    void create_ok() throws Exception {
        VisitDto newVisit = new VisitDto()
                .setPetId(petId)
                .setDate(LocalDate.now())
                .setDescription("annual checkup");

        mockMvc.perform(post("/api/visits")
                .content(mapper.writeValueAsString(newVisit))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().isCreated());

        assertThat(visitRepository.findAll())
                .anyMatch(v -> "annual checkup".equals(v.getDescription()));
    }

    @Test
    void update_ok() throws Exception {
        VisitFieldsDto update = new VisitFieldsDto()
                .setDate(LocalDate.now().plusDays(1))
                .setDescription("updated description");

        mockMvc.perform(put("/api/visits/" + visitId)
                .content(mapper.writeValueAsString(update))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().isOk());

        Visit updated = visitRepository.findById(visitId).orElseThrow();
        assertThat(updated.getDescription()).isEqualTo("updated description");
    }

    // ── the vet who attended the visit (#37) ──────────────────────────────────────

    @Test
    void create_withoutVet_leavesItUnassigned() throws Exception {
        VisitDto newVisit = new VisitDto()
                .setPetId(petId)
                .setDate(LocalDate.now())
                .setDescription("no vet yet");

        mockMvc.perform(post("/api/visits")
                .content(mapper.writeValueAsString(newVisit))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().isCreated());

        assertThat(visitRepository.findByPetId(petId))
                .filteredOn(v -> "no vet yet".equals(v.getDescription()))
                .singleElement()
                .extracting(Visit::getVet)
                .isNull();
    }

    @Test
    void create_withVet_recordsWhoAttends() throws Exception {
        VisitDto newVisit = new VisitDto()
                .setPetId(petId)
                .setDate(LocalDate.now())
                .setDescription("attended checkup")
                .setVetId(vetId);

        mockMvc.perform(post("/api/visits")
                .content(mapper.writeValueAsString(newVisit))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().isCreated());

        assertThat(visitRepository.findByPetId(petId))
                .filteredOn(v -> "attended checkup".equals(v.getDescription()))
                .singleElement()
                .extracting(v -> v.getVet().getId())
                .isEqualTo(vetId);
    }

    @Test
    void bookingUnderTheOwnerRecordsTheVet() throws Exception {
        VisitFieldsDto booking = new VisitFieldsDto()
                .setDate(LocalDate.now())
                .setDescription("booked with a vet")
                .setVetId(vetId);

        mockMvc.perform(post("/api/owners/" + ownerId + "/pets/" + petId + "/visits")
                .content(mapper.writeValueAsString(booking))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().isCreated());

        assertThat(visitRepository.findByPetId(petId))
                .filteredOn(v -> "booked with a vet".equals(v.getDescription()))
                .singleElement()
                .extracting(v -> v.getVet().getId())
                .isEqualTo(vetId);
    }

    @Test
    void create_unknownVet_notFound() throws Exception {
        VisitDto newVisit = new VisitDto()
                .setPetId(petId)
                .setDate(LocalDate.now())
                .setDescription("booked with a ghost")
                .setVetId(99999);

        mockMvc.perform(post("/api/visits")
                .content(mapper.writeValueAsString(newVisit))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().isNotFound());
    }

    @Test
    void update_assignsTheVet() throws Exception {
        VisitFieldsDto update = new VisitFieldsDto()
                .setDate(LocalDate.now())
                .setDescription("rabies shot")
                .setVetId(vetId);

        mockMvc.perform(put("/api/visits/" + visitId)
                .content(mapper.writeValueAsString(update))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().isOk());

        assertThat(visitRepository.findById(visitId).orElseThrow().getVet().getId()).isEqualTo(vetId);
    }

    @Test
    void getAll_namesTheVetAndLeavesUnattendedVisitsEmpty() throws Exception {
        Visit visit = visitRepository.findById(visitId).orElseThrow();
        visit.setVet(vetRepository.findById(vetId).orElseThrow());
        visitRepository.save(visit);

        VisitDto attended = allVisits().stream().filter(v -> v.getId() == visitId).findFirst().orElseThrow();
        assertThat(attended.getVetId()).isEqualTo(vetId);
        assertThat(attended.getVetFirstName()).isEqualTo("Helen");
        assertThat(attended.getVetLastName()).isEqualTo("Leary");

        VisitDto unattended = callGet(anUnattendedVisit("spayed"));
        assertThat(unattended.getVetId()).isNull();
        assertThat(unattended.getVetFirstName()).isNull();
        assertThat(unattended.getVetLastName()).isNull();
    }

    private int anUnattendedVisit(String description) {
        Visit visit = new Visit();
        visit.setDate(LocalDate.now());
        visit.setDescription(description);
        petRepository.findById(petId).orElseThrow().addVisit(visit);
        visitRepository.save(visit);
        return visit.getId();
    }

    private List<VisitDto> allVisits() throws Exception {
        String responseJson = mockMvc.perform(get("/api/visits"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return Arrays.asList(mapper.readValue(responseJson, VisitDto[].class));
    }

    @Test
    void findVisitsByPetId() {
        // Add a second visit for the same pet
        Visit visit2 = new Visit();
        visit2.setDate(LocalDate.now().minusDays(1));
        visit2.setDescription("checkup");
        petRepository.findById(petId).orElseThrow().addVisit(visit2);
        visitRepository.save(visit2);

        // Test repository method findByPetId
        var visits = visitRepository.findByPetId(petId);

        assertThat(visits).hasSize(2);
        assertThat(visits).allSatisfy(visit -> {
            assertThat(visit.getPet()).isNotNull();
            assertThat(visit.getPet().getId()).isEqualTo(petId);
            assertThat(visit.getDate()).isNotNull();
        });
    }
}
