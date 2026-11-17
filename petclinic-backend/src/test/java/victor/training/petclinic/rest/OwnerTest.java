package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.text.SimpleDateFormat;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.StreamSupport;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.PetType;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.PetTypeRepository;
import victor.training.petclinic.rest.dto.OwnerDto;
import victor.training.petclinic.rest.dto.PetDto;
import victor.training.petclinic.rest.dto.PetTypeDto;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import jakarta.transaction.Transactional;

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
public class OwnerTest {

    @Autowired
    MockMvc mockMvc;

    ObjectMapper mapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .setDateFormat(new SimpleDateFormat("yyyy-MM-dd"))
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    @Autowired
    OwnerRepository ownerRepository;

    @Autowired
    PetRepository petRepository;

    @Autowired
    PetTypeRepository petTypeRepository;

    int ownerId;
    int petId;
    PetType petType;

    @BeforeEach
    final void before() {
        Owner owner = TestData.anOwner();
        owner.setFirstName("George");
        owner.setLastName("Franklin");
        owner = ownerRepository.save(owner);
        ownerId = owner.getId();

        petType = new PetType();
        petType.setName("dog");
        petType = petTypeRepository.save(petType);

        Pet pet = new Pet();
        pet.setName("Rosy");
        pet.setBirthDate(LocalDate.now());
        pet.setOwner(owner);
        pet.setType(petType);
        pet = petRepository.save(pet);
        petId = pet.getId();

        // Add pet to owner's collection for bidirectional relationship
        owner.addPet(pet);
    }

    private OwnerDto callGet(int ownerId) throws Exception {
        String responseJson = mockMvc.perform(get("/api/owners/" + ownerId))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json"))
                .andReturn()
                .getResponse()
                .getContentAsString();
        return mapper.readValue(responseJson, OwnerDto.class);
    }

    @Test
    void getByIdOk() throws Exception {
        OwnerDto responseDto = callGet(ownerId);

        assertThat(responseDto.getId()).isEqualTo(ownerId);
        assertThat(responseDto.getFirstName()).isEqualTo("George");
        assertThat(responseDto.getLastName()).isEqualTo("Franklin");
    }

    @Test
    void getById_notFound() throws Exception {
        mockMvc.perform(get("/api/owners/99999"))
                .andExpect(status().isNotFound());
    }

    @Test
    void count_returnsOwnerCount() throws Exception {
        long before = ownerRepository.count();

        mockMvc.perform(get("/api/owners/count"))
                .andExpect(status().isOk())
                .andExpect(content().string(String.valueOf(before)));
    }

    @Test
    void getAll() throws Exception {
        JsonNode page = getPage("/api/owners");

        assertThat(ownerIds(page)).contains(ownerId);
        assertThat(page.get("content").get(0).get("firstName").asText()).isEqualTo("George");
        assertThat(page.get("content").get(0).get("pets").get(0).get("name").asText()).isEqualTo("Rosy");
    }

    @Test
    void defaultPage_isTheEnvelopeOfTheFirstTenOwners() throws Exception {
        saveOwners(22); // + George = 23

        JsonNode page = getPage("/api/owners");

        assertThat(page.isObject()).isTrue();
        assertThat(page.get("content")).hasSize(10);
        assertThat(page.get("totalElements").asLong()).isEqualTo(23);
        assertThat(page.get("totalPages").asInt()).isEqualTo(3);
        assertThat(page.get("number").asInt()).isZero();
        assertThat(page.get("size").asInt()).isEqualTo(10);
    }

    @ParameterizedTest
    @ValueSource(ints = {5, 10, 20})
    void supportedPageSizes(int size) throws Exception {
        saveOwners(22);

        JsonNode page = getPage("/api/owners?size=" + size);

        assertThat(page.get("content")).hasSize(size);
        assertThat(page.get("size").asInt()).isEqualTo(size);
        assertThat(page.get("totalPages").asInt()).isEqualTo((23 + size - 1) / size);
    }

    @Test
    void partialLastPage() throws Exception {
        saveOwners(22);

        JsonNode page = getPage("/api/owners?page=2&size=10");

        assertThat(page.get("content")).hasSize(3);
        assertThat(page.get("totalElements").asLong()).isEqualTo(23);
        assertThat(page.get("number").asInt()).isEqualTo(2);
    }

    @Test
    void pageBeyondTheResult_isEmptyButKeepsTheTotals() throws Exception {
        saveOwners(22);

        JsonNode page = getPage("/api/owners?page=9&size=10");

        assertThat(page.get("content")).isEmpty();
        assertThat(page.get("number").asInt()).isEqualTo(9);
        assertThat(page.get("totalElements").asLong()).isEqualTo(23);
        assertThat(page.get("totalPages").asInt()).isEqualTo(3);
    }

    @Test
    void getAllWithLastNameFilter_totalsDescribeTheFilteredResult() throws Exception {
        saveOwners(22);
        Owner owner2 = TestData.anOwner();
        owner2.setLastName("JavaBeans");
        int owner2Id = ownerRepository.save(owner2).getId();

        JsonNode page = getPage("/api/owners?lastName=Java&size=5");

        assertThat(ownerIds(page)).containsExactly(owner2Id);
        assertThat(page.get("totalElements").asLong()).isEqualTo(1);
        assertThat(page.get("totalPages").asInt()).isEqualTo(1);
    }

    @Test
    void getAllWithNameFilter_notFound() throws Exception {
        JsonNode page = getPage("/api/owners?lastName=NonExistent");

        assertThat(page.get("content")).isEmpty();
        assertThat(page.get("totalElements").asLong()).isZero();
        assertThat(page.get("totalPages").asInt()).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "page=-1", "page=abc", "page=", "page=1&page=2", "page=99999999999",
            "size=7", "size=100", "size=0", "size=abc", "size=10&size=20",
            "sort=pets,asc", "sort=firstName,asc", "sort=address,asc", "sort=telephone,desc", "sort=lastName",
            "sort=lastName,up", "sort=lastName,asc,city,asc",
            "sort=lastName,asc&sort=city,desc", "sort=,asc", "sort=lastName;drop table owners,asc",
            "lastName=A&lastName=B"})
    void invalidListParameters_areRejected(String query) throws Exception {
        mockMvc.perform(get("/api/owners?" + query))
                .andExpect(status().isBadRequest());
    }

    @Test
    void lastNameWithNulCharacter_isRejected() throws Exception {
        mockMvc.perform(get("/api/owners").param("lastName", "Fr\u0000anklin"))
                .andExpect(status().isBadRequest());
    }

    @ParameterizedTest
    @ValueSource(strings = {"lastName,asc", "lastName,desc", "city,asc", "city,desc"})
    void supportedSorts_areAccepted(String sort) throws Exception {
        mockMvc.perform(get("/api/owners?sort=" + sort))
                .andExpect(status().isOk());
    }

    private void saveOwners(int count) {
        for (int i = 0; i < count; i++) {
            Owner owner = TestData.anOwner();
            owner.setLastName("Owner%02d".formatted(i));
            ownerRepository.save(owner);
        }
    }

    private JsonNode getPage(String uriTemplate) throws Exception {
        String responseJson = mockMvc.perform(get(uriTemplate))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json"))
                .andReturn()
                .getResponse()
                .getContentAsString();
        return mapper.readTree(responseJson);
    }

    private static List<Integer> ownerIds(JsonNode page) {
        return StreamSupport.stream(page.get("content").spliterator(), false)
                .map(owner -> owner.get("id").asInt())
                .toList();
    }

    @Test
    void update_ok() throws Exception {
        OwnerDto existing = callGet(ownerId);
        existing.setFirstName("GeorgeI");

        mockMvc.perform(put("/api/owners/" + ownerId)
                .content(mapper.writeValueAsString(existing))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().is2xxSuccessful());

        // assert the update took place
        OwnerDto updated = callGet(ownerId);
        assertThat(updated.getFirstName()).isEqualTo("GeorgeI");
    }

    @Test
    void update_okNoBodyId() throws Exception {
        OwnerDto existing = callGet(ownerId);
        existing.setId(null); // Test without body ID
        existing.setFirstName("GeorgeII");

        mockMvc.perform(put("/api/owners/" + ownerId)
                .content(mapper.writeValueAsString(existing))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().is2xxSuccessful());

        // assert the update took place
        OwnerDto updated = callGet(ownerId);
        assertThat(updated.getFirstName()).isEqualTo("GeorgeII");
    }

    @Test
    void update_invalid() throws Exception {
        OwnerDto existing = callGet(ownerId);
        existing.setFirstName(""); // invalid firstName

        mockMvc.perform(put("/api/owners/" + ownerId)
                .content(mapper.writeValueAsString(existing))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void delete_ok() throws Exception {
        mockMvc.perform(delete("/api/owners/" + ownerId))
                .andExpect(status().is2xxSuccessful());

        mockMvc.perform(get("/api/owners/" + ownerId))
                .andExpect(status().isNotFound());
    }

    @Test
    void delete_notFound() throws Exception {
        mockMvc.perform(delete("/api/owners/9999"))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void createPet_invalid() throws Exception {
        PetTypeDto typeDto = new PetTypeDto()
                .setId(petType.getId())
                .setName(petType.getName());
        // missing name - validation error
        PetDto newPet = new PetDto()
                .setBirthDate(LocalDate.now())
                .setType(typeDto);

        mockMvc.perform(post("/api/owners/" + ownerId + "/pets")
                .content(mapper.writeValueAsString(newPet))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().isBadRequest());
    }

    @Test
    void getOwnerPet_ok() throws Exception {
        mockMvc.perform(get("/api/owners/" + ownerId + "/pets/" + petId))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json"))
                .andExpect(jsonPath("$.id").value(petId))
                .andExpect(jsonPath("$.name").value("Rosy"));
    }

    @Test
    void getOwnerPet_ownerNotFound() throws Exception {
        mockMvc.perform(get("/api/owners/99999/pets/" + petId))
                .andExpect(status().isNotFound());
    }

    @Test
    void getOwnerPet_petNotFound() throws Exception {
        mockMvc.perform(get("/api/owners/" + ownerId + "/pets/99999"))
                .andExpect(status().isNotFound());
    }

    @Test
    void updateOwnerPet_ok() throws Exception {
        PetTypeDto typeDto = new PetTypeDto()
                .setId(petType.getId())
                .setName(petType.getName());
        PetDto petDto = new PetDto()
                .setId(petId)
                .setName("Rosy Updated")
                .setBirthDate(LocalDate.of(2020, 1, 15))
                .setType(typeDto);

        mockMvc.perform(put("/api/owners/" + ownerId + "/pets/" + petId)
                .content(mapper.writeValueAsString(petDto))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().is2xxSuccessful());
    }

    @Test
    void updateOwnerPet_ownerNotFound() throws Exception {
        PetTypeDto typeDto = new PetTypeDto()
                .setId(petType.getId())
                .setName(petType.getName());
        PetDto petDto = new PetDto()
                .setName("Thor")
                .setBirthDate(LocalDate.now())
                .setType(typeDto);

        mockMvc.perform(put("/api/owners/99999/pets/" + petId)
                .content(mapper.writeValueAsString(petDto))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().is2xxSuccessful());
    }

    @Test
    void updateOwnerPet_petNotFound() throws Exception {
        PetTypeDto typeDto = new PetTypeDto()
                .setId(petType.getId())
                .setName(petType.getName());
        PetDto petDto = new PetDto()
                .setName("Ghost")
                .setBirthDate(LocalDate.of(2020, 1, 1))
                .setType(typeDto);

        mockMvc.perform(put("/api/owners/" + ownerId + "/pets/99999")
                .content(mapper.writeValueAsString(petDto))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().isNotFound());
    }

}
