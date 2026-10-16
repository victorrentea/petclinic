package victor.training.petclinic.rest;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import jakarta.persistence.EntityManager;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
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

    @Autowired
    EntityManager entityManager;

    int visitId;
    int petId;
    int ownerId;
    Vet vet;
    @Autowired
    private PetTypeRepository petTypeRepository;

    @BeforeEach
    final void before() {
        Owner owner = ownerRepository.save(TestData.anOwner());
        Pet pet = TestData.aPet();
        pet.setOwner(owner);
        pet.setType(petTypeRepository.save(TestData.aPetType("dog")));
        petRepository.save(pet);
        petId = pet.getId();
        ownerId = owner.getId();

        vet = new Vet();
        vet.setFirstName("James");
        vet.setLastName("Herriot");
        vetRepository.save(vet);

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

    @Test
    void create_withVet() throws Exception {
        VisitDto newVisit = new VisitDto()
                .setPetId(petId)
                .setDate(LocalDate.now())
                .setDescription("annual checkup")
                .setVetId(vet.getId());

        String location = mockMvc.perform(post("/api/visits")
                .content(mapper.writeValueAsString(newVisit))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getHeader("Location");
        flushAndClear();

        VisitDto created = callGet(idFrom(location));
        assertThat(created.getVetId()).isEqualTo(vet.getId());
        assertThat(created.getVetFirstName()).isEqualTo("James");
        assertThat(created.getVetLastName()).isEqualTo("Herriot");
    }

    @Test
    void create_withoutVet() throws Exception {
        VisitDto newVisit = new VisitDto()
                .setPetId(petId)
                .setDate(LocalDate.now())
                .setDescription("annual checkup");

        String location = mockMvc.perform(post("/api/visits")
                .content(mapper.writeValueAsString(newVisit))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getHeader("Location");

        VisitDto created = callGet(idFrom(location));
        assertThat(created.getVetId()).isNull();
        assertThat(created.getVetFirstName()).isNull();
        assertThat(created.getVetLastName()).isNull();
    }

    @Test
    void create_withUnknownVet_notFound() throws Exception {
        VisitDto newVisit = new VisitDto()
                .setPetId(petId)
                .setDate(LocalDate.now())
                .setDescription("annual checkup")
                .setVetId(99999);

        mockMvc.perform(post("/api/visits")
                .content(mapper.writeValueAsString(newVisit))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().isNotFound());
    }

    @Test
    void bookFromOwnerPage_withVet_isShownOnOwnerPage() throws Exception {
        VisitFieldsDto newVisit = new VisitFieldsDto()
                .setDate(LocalDate.now())
                .setDescription("ear infection")
                .setVetId(vet.getId());

        mockMvc.perform(post("/api/owners/{ownerId}/pets/{petId}/visits", ownerId, petId)
                .content(mapper.writeValueAsString(newVisit))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().isCreated());
        flushAndClear();

        mockMvc.perform(get("/api/owners/{ownerId}", ownerId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pets[0].visits[?(@.description == 'ear infection')].vetId")
                        .value(vet.getId()))
                .andExpect(jsonPath("$.pets[0].visits[?(@.description == 'ear infection')].vetLastName")
                        .value("Herriot"))
                .andExpect(jsonPath("$.pets[0].visits[?(@.description == 'rabies shot')].vetId")
                        .value(contains(nullValue())));
    }

    @Test
    void bookFromOwnerPage_withoutVet() throws Exception {
        VisitFieldsDto newVisit = new VisitFieldsDto()
                .setDate(LocalDate.now())
                .setDescription("ear infection");

        mockMvc.perform(post("/api/owners/{ownerId}/pets/{petId}/visits", ownerId, petId)
                .content(mapper.writeValueAsString(newVisit))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().isCreated());

        assertThat(visitRepository.findByPetId(petId))
                .filteredOn(v -> "ear infection".equals(v.getDescription()))
                .singleElement()
                .extracting(Visit::getVet)
                .isNull();
    }

    @Test
    void bookFromOwnerPage_withUnknownVet_notFound() throws Exception {
        VisitFieldsDto newVisit = new VisitFieldsDto()
                .setDate(LocalDate.now())
                .setDescription("ear infection")
                .setVetId(99999);

        mockMvc.perform(post("/api/owners/{ownerId}/pets/{petId}/visits", ownerId, petId)
                .content(mapper.writeValueAsString(newVisit))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().isNotFound());
    }

    @Test
    void update_assignsVet() throws Exception {
        VisitFieldsDto update = new VisitFieldsDto()
                .setDate(LocalDate.now())
                .setDescription("rabies shot")
                .setVetId(vet.getId());

        mockMvc.perform(put("/api/visits/" + visitId)
                .content(mapper.writeValueAsString(update))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().isOk());
        flushAndClear();

        assertThat(callGet(visitId).getVetId()).isEqualTo(vet.getId());
    }

    @Test
    void update_withUnknownVet_notFound() throws Exception {
        VisitFieldsDto update = new VisitFieldsDto()
                .setDate(LocalDate.now())
                .setDescription("rabies shot")
                .setVetId(99999);

        mockMvc.perform(put("/api/visits/" + visitId)
                .content(mapper.writeValueAsString(update))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().isNotFound());
    }

    @Test
    void update_clearsVet() throws Exception {
        Visit visit = visitRepository.findById(visitId).orElseThrow();
        visit.setVet(vet);
        visitRepository.save(visit);
        flushAndClear();
        VisitFieldsDto update = new VisitFieldsDto()
                .setDate(LocalDate.now())
                .setDescription("rabies shot")
                .setVetId(null);

        mockMvc.perform(put("/api/visits/" + visitId)
                .content(mapper.writeValueAsString(update))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().isOk());
        flushAndClear();

        VisitDto updated = callGet(visitId);
        assertThat(updated.getVetId()).isNull();
        assertThat(updated.getVetLastName()).isNull();
    }

    @Test
    void getAll_returnsVetNames() throws Exception {
        Visit visit = visitRepository.findById(visitId).orElseThrow();
        visit.setVet(vet);
        visitRepository.save(visit);
        flushAndClear();

        mockMvc.perform(get("/api/visits"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == %d)].vetFirstName", visitId).value("James"))
                .andExpect(jsonPath("$[?(@.id == %d)].vetLastName", visitId).value("Herriot"));
    }

    @Test
    @WithMockUser(roles = {"OWNER_ADMIN", "VET_ADMIN"})
    void deletingAVet_leavesTheirVisitsWithNoVet() throws Exception {
        Visit visit = visitRepository.findById(visitId).orElseThrow();
        visit.setVet(vet);
        visitRepository.save(visit);
        flushAndClear();

        mockMvc.perform(delete("/api/vets/" + vet.getId()))
                .andExpect(status().isOk());
        flushAndClear();

        VisitDto kept = callGet(visitId);
        assertThat(kept.getDescription()).isEqualTo("rabies shot");
        assertThat(kept.getVetId()).isNull();
    }

    /** As a fresh request would: what is read next comes from the database, not this test's session. */
    private void flushAndClear() {
        entityManager.flush();
        entityManager.clear();
    }

    private static int idFrom(String location) {
        return Integer.parseInt(location.substring(location.lastIndexOf('/') + 1));
    }
}
