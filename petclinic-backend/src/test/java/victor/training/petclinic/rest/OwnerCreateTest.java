package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.text.SimpleDateFormat;
import java.time.LocalDate;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import jakarta.transaction.Transactional;

import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.PetType;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.PetTypeRepository;
import victor.training.petclinic.repository.VisitRepository;
import victor.training.petclinic.rest.dto.OwnerFieldsDto;
import victor.training.petclinic.rest.dto.PetFieldsDto;
import victor.training.petclinic.rest.dto.PetTypeDto;
import victor.training.petclinic.rest.dto.VisitFieldsDto;

// Covers the POST/create endpoints of OwnerRestController (addOwner, addPetToOwner, addVisitToOwner)
// whose success paths were uncovered by Sonar new-code coverage.
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerCreateTest {

    @Autowired MockMvc mockMvc;
    @Autowired OwnerRepository ownerRepository;
    @Autowired PetRepository petRepository;
    @Autowired PetTypeRepository petTypeRepository;
    @Autowired VisitRepository visitRepository;

    private final ObjectMapper mapper = new ObjectMapper()
        .registerModule(new JavaTimeModule())
        .setDateFormat(new SimpleDateFormat("yyyy-MM-dd"))
        .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private int ownerId;
    private int petId;
    private PetType petType;

    @BeforeEach
    void before() {
        Owner owner = TestData.anOwner();
        owner.setLastName("Creator");
        owner = ownerRepository.save(owner);
        ownerId = owner.getId();

        petType = new PetType();
        petType.setName("hamster");
        petType = petTypeRepository.save(petType);

        Pet pet = new Pet();
        pet.setName("Nibbles");
        pet.setBirthDate(LocalDate.of(2021, 3, 3));
        pet.setOwner(owner);
        pet.setType(petType);
        pet = petRepository.save(pet);
        petId = pet.getId();
    }

    @Test
    void addOwner_created() throws Exception {
        OwnerFieldsDto dto = new OwnerFieldsDto();
        dto.setFirstName("Nikola");
        dto.setLastName("Tesla");
        dto.setAddress("10 Coil Ave");
        dto.setCity("Smiljan");
        dto.setTelephone("0700000111");

        mockMvc.perform(post("/api/owners")
                .content(mapper.writeValueAsString(dto))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().isCreated())
            .andExpect(header().exists("Location"));

        assertThat(ownerRepository.findByLastNameStartingWith("Tesla")).isNotEmpty();
    }

    @Test
    void addOwner_invalid_isBadRequest() throws Exception {
        OwnerFieldsDto dto = new OwnerFieldsDto();
        dto.setFirstName(""); // violates @Size(min=1)
        dto.setLastName("Tesla");
        dto.setAddress("10 Coil Ave");
        dto.setCity("Smiljan");
        dto.setTelephone("0700000111");

        mockMvc.perform(post("/api/owners")
                .content(mapper.writeValueAsString(dto))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().isBadRequest());
    }

    @Test
    void addPetToOwner_created() throws Exception {
        PetFieldsDto dto = new PetFieldsDto();
        dto.setName("Spike");
        dto.setBirthDate(LocalDate.of(2022, 1, 1));
        PetTypeDto typeDto = new PetTypeDto();
        typeDto.setId(petType.getId());
        typeDto.setName(petType.getName());
        dto.setType(typeDto);

        mockMvc.perform(post("/api/owners/" + ownerId + "/pets")
                .content(mapper.writeValueAsString(dto))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().isCreated())
            .andExpect(header().exists("Location"));
    }

    @Test
    void addVisitToOwner_created() throws Exception {
        VisitFieldsDto dto = new VisitFieldsDto();
        dto.setDate(LocalDate.of(2026, 6, 1));
        dto.setDescription("Routine checkup");

        mockMvc.perform(post("/api/owners/" + ownerId + "/pets/" + petId + "/visits")
                .content(mapper.writeValueAsString(dto))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().isCreated())
            .andExpect(header().exists("Location"));

        assertThat(visitRepository.findByPetId(petId))
            .extracting(v -> v.getDescription())
            .contains("Routine checkup");
    }
}
