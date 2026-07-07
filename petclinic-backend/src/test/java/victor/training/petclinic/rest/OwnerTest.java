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
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.PetTypeRepository;
import victor.training.petclinic.rest.dto.OwnerDto;
import victor.training.petclinic.rest.dto.PetDto;
import victor.training.petclinic.rest.dto.PetTypeDto;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.core.type.TypeReference;
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
        List<OwnerDto> owners = search("/api/owners");

        assertThat(owners)
            .extracting(OwnerDto::getId, OwnerDto::getFirstName, OwnerDto::getLastName)
            .contains(Assertions.tuple(ownerId, "George", "Franklin"));
    }

    @Test
    void getAll_returnsFirstPageWithMetadata() throws Exception {
        mockMvc.perform(get("/api/owners"))
            .andExpect(status().isOk())
            .andExpect(content().contentType("application/json"))
            .andExpect(jsonPath("$.page").value(1))
            .andExpect(jsonPath("$.pageSize").value(10))
            .andExpect(jsonPath("$.totalItems").value(ownerRepository.count()))
            .andExpect(jsonPath("$.totalPages").value((int) Math.ceil(ownerRepository.count() / 10.0)))
            .andExpect(jsonPath("$.sort.field").value("name"))
            .andExpect(jsonPath("$.sort.direction").value("asc"))
            .andExpect(jsonPath("$.items.length()").value(Math.min(ownerRepository.count(), 10)));
    }

    @Test
    void getAll_supportsRequestedPageSize() throws Exception {
        mockMvc.perform(get("/api/owners?pageSize=5"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.page").value(1))
            .andExpect(jsonPath("$.pageSize").value(5))
            .andExpect(jsonPath("$.totalPages").value((int) Math.ceil(ownerRepository.count() / 5.0)))
            .andExpect(jsonPath("$.items.length()").value(5));
    }

    @Test
    void getAll_normalizesUnsupportedPageSizeToDefault() throws Exception {
        mockMvc.perform(get("/api/owners?pageSize=1000000"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.page").value(1))
            .andExpect(jsonPath("$.pageSize").value(10))
            .andExpect(jsonPath("$.items.length()").value(Math.min(ownerRepository.count(), 10)));
    }

    @Test
    void getAll_sortsFilteredResultsByName() throws Exception {
        saveOwner("Aaron", "PagingAlpha", "Cluj", "1234567891");
        saveOwner("Mira", "PagingBeta", "Bucharest", "1234567892");
        saveOwner("Zed", "PagingGamma", "Arad", "1234567893");

        JsonNode response = listOwners("/api/owners?lastName=Paging&sort=name&direction=desc&pageSize=20");

        assertThat(response.get("items"))
            .extracting(item -> item.get("lastName").asText())
            .containsExactly("PagingGamma", "PagingBeta", "PagingAlpha");
    }

    @Test
    void getAll_sortsFilteredResultsByCity() throws Exception {
        saveOwner("Ana", "PagingCityA", "Zurich", "1234567894");
        saveOwner("Bob", "PagingCityB", "Amsterdam", "1234567895");
        saveOwner("Cia", "PagingCityC", "Berlin", "1234567896");

        JsonNode response = listOwners("/api/owners?lastName=PagingCity&sort=city&direction=asc&pageSize=20");

        assertThat(response.get("items"))
            .extracting(item -> item.get("city").asText())
            .containsExactly("Amsterdam", "Berlin", "Zurich");
    }

    @Test
    void getAll_pagesWithinFilteredResults() throws Exception {
        saveOwner("Ana", "PagingPageAlpha", "Zurich", "1234567801");
        saveOwner("Bob", "PagingPageBeta", "Amsterdam", "1234567802");
        saveOwner("Cia", "PagingPageGamma", "Berlin", "1234567803");
        saveOwner("Dan", "PagingPageDelta", "Paris", "1234567804");
        saveOwner("Ema", "PagingPageEpsilon", "Rome", "1234567805");
        saveOwner("Flo", "PagingPageZeta", "Madrid", "1234567806");

        JsonNode response = listOwners("/api/owners?lastName=PagingPage&page=2&pageSize=5&sort=name&direction=asc");

        assertThat(response.get("page").asInt()).isEqualTo(2);
        assertThat(response.get("pageSize").asInt()).isEqualTo(5);
        assertThat(response.get("totalItems").asInt()).isEqualTo(6);
        assertThat(response.get("totalPages").asInt()).isEqualTo(2);
        assertThat(response.get("items"))
            .extracting(item -> item.get("lastName").asText())
            .containsExactly("PagingPageZeta");
    }

    @Test
    void getAll_normalizesInvalidSortToDefaultNameSort() throws Exception {
        saveOwner("Aaron", "PagingInvalidAlpha", "Cluj", "1234567897");
        saveOwner("Zed", "PagingInvalidGamma", "Arad", "1234567898");

        JsonNode response = listOwners("/api/owners?lastName=PagingInvalid&sort=unknown&direction=sideways&pageSize=20");

        assertThat(response.get("sort").get("field").asText()).isEqualTo("name");
        assertThat(response.get("sort").get("direction").asText()).isEqualTo("asc");
        assertThat(response.get("items"))
            .extracting(item -> item.get("lastName").asText())
            .containsExactly("PagingInvalidAlpha", "PagingInvalidGamma");
    }

    @Test
    void getAllWithAddressFilter() throws Exception {
        Owner owner2 = TestData.anOwner();
        owner2.setLastName("JavaBeans");
        int owner2Id = ownerRepository.save(owner2).getId();

        List<OwnerDto> owners = search("/api/owners?lastName=Java");

        assertThat(owners)
            .extracting(OwnerDto::getId, OwnerDto::getLastName)
            .contains(Assertions.tuple(owner2Id, "JavaBeans"));
    }

    private List<OwnerDto> search(String uriTemplate) throws Exception {
        JsonNode response = listOwners(uriTemplate);
        return mapper.readerFor(new TypeReference<List<OwnerDto>>() {
        }).readValue(response.get("items"));
    }

    private JsonNode listOwners(String uriTemplate) throws Exception {
        String responseJson = mockMvc.perform(get(uriTemplate))
            .andExpect(status().isOk())
            .andExpect(content().contentType("application/json"))
            .andReturn()
            .getResponse()
            .getContentAsString();

        return mapper.readTree(responseJson);
    }

    private int saveOwner(String firstName, String lastName, String city, String telephone) {
        Owner owner = TestData.anOwner();
        owner.setFirstName(firstName);
        owner.setLastName(lastName);
        owner.setCity(city);
        owner.setTelephone(telephone);
        return ownerRepository.save(owner).getId();
    }

    @Test
    void getAllWithNameFilter_notFound() throws Exception {
        List<OwnerDto> results = search("/api/owners?lastName=NonExistent");

        assertThat(results).isEmpty();
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
        PetDto newPet = new PetDto();
        // missing name - validation error
        newPet.setBirthDate(LocalDate.now());
        PetTypeDto typeDto = new PetTypeDto();
        typeDto.setId(petType.getId());
        typeDto.setName(petType.getName());
        newPet.setType(typeDto);

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
        PetDto petDto = new PetDto();
        petDto.setId(petId);
        petDto.setName("Rosy Updated");
        petDto.setBirthDate(LocalDate.of(2020, 1, 15));
        PetTypeDto typeDto = new PetTypeDto();
        typeDto.setId(petType.getId());
        typeDto.setName(petType.getName());
        petDto.setType(typeDto);

        mockMvc.perform(put("/api/owners/" + ownerId + "/pets/" + petId)
                .content(mapper.writeValueAsString(petDto))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().is2xxSuccessful());
    }

    @Test
    void updateOwnerPet_ownerNotFound() throws Exception {
        PetDto petDto = new PetDto();
        petDto.setName("Thor");
        petDto.setBirthDate(LocalDate.now());
        PetTypeDto typeDto = new PetTypeDto();
        typeDto.setId(petType.getId());
        typeDto.setName(petType.getName());
        petDto.setType(typeDto);

        mockMvc.perform(put("/api/owners/99999/pets/" + petId)
                .content(mapper.writeValueAsString(petDto))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().is2xxSuccessful());
    }

    @Test
    void updateOwnerPet_petNotFound() throws Exception {
        PetDto petDto = new PetDto();
        petDto.setName("Ghost");
        petDto.setBirthDate(LocalDate.of(2020, 1, 1));
        PetTypeDto typeDto = new PetTypeDto();
        typeDto.setId(petType.getId());
        typeDto.setName(petType.getName());
        petDto.setType(typeDto);

        mockMvc.perform(put("/api/owners/" + ownerId + "/pets/99999")
                .content(mapper.writeValueAsString(petDto))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().isNotFound());
    }

}
