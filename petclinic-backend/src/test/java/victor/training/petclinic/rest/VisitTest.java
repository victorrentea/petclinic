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
import victor.training.petclinic.model.Owner;
import victor.training.petclinic.model.Pet;
import victor.training.petclinic.model.PetType;
import victor.training.petclinic.model.Visit;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.PetTypeRepository;
import victor.training.petclinic.repository.VisitRepository;
import victor.training.petclinic.rest.dto.VisitDto;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;

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

    int visitId;
    int petId;
    @Autowired
    private PetTypeRepository petTypeRepository;

    @BeforeEach
    final void before() {
        Owner owner = ownerRepository.save(TestData.anOwner());
        Pet pet = TestData.aPet()
            .setOwner(owner)
            .setType(petTypeRepository.save(new PetType().setName("dog")));
        petRepository.save(pet);
        petId = pet.getId();

        Visit visit = new Visit();
        visit.setPet(pet);
        visit.setDate(LocalDate.now());
        visit.setDescription("rabies shot");
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

        VisitDto created = java.util.Arrays.stream(visits)
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
        VisitDto newVisit = new VisitDto();
        newVisit.setPetId(petId);
        newVisit.setDate(LocalDate.now());
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
    void findVisitsByPetId() {
        // Add a second visit for the same pet
        Visit visit2 = new Visit();
        visit2.setPet(petRepository.findById(petId).orElseThrow());
        visit2.setDate(LocalDate.now().minusDays(1));
        visit2.setDescription("checkup");
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
