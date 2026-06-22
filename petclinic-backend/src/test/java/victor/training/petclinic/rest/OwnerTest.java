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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
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
import org.springframework.test.web.servlet.ResultActions;

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
    void getAllWithLastNameFilter() throws Exception {
        Owner owner2 = TestData.anOwner();
        owner2.setLastName("JavaBeans");
        int owner2Id = ownerRepository.save(owner2).getId();

        List<OwnerDto> owners = search("/api/owners?q=Java");

        assertThat(owners)
            .extracting(OwnerDto::getId, OwnerDto::getLastName)
            .contains(Assertions.tuple(owner2Id, "JavaBeans"));
    }

    @Test
    void search_byCity_caseInsensitive() throws Exception {
        Owner owner2 = TestData.anOwner();
        owner2.setLastName("Wozniak");
        owner2.setCity("Cupertino");
        int owner2Id = ownerRepository.save(owner2).getId();

        // lowercase query against mixed-case data
        List<OwnerDto> owners = search("/api/owners?q=cupertino");

        assertThat(owners)
            .extracting(OwnerDto::getId)
            .contains(owner2Id);
    }

    @Test
    void search_byAddress_midStringContains() throws Exception {
        Owner owner2 = TestData.anOwner();
        owner2.setLastName("Kernighan");
        owner2.setAddress("742 Evergreen Terrace");
        int owner2Id = ownerRepository.save(owner2).getId();

        // "green" is in the middle of "Evergreen", not a prefix
        List<OwnerDto> owners = search("/api/owners?q=green");

        assertThat(owners)
            .extracting(OwnerDto::getId)
            .contains(owner2Id);
    }

    @Test
    void search_byTelephone_substring() throws Exception {
        Owner owner2 = TestData.anOwner();
        owner2.setLastName("Ritchie");
        owner2.setTelephone("0755123456");
        int owner2Id = ownerRepository.save(owner2).getId();

        List<OwnerDto> owners = search("/api/owners?q=5512");

        assertThat(owners)
            .extracting(OwnerDto::getId)
            .contains(owner2Id);
    }

    @Test
    void search_byPetName_caseInsensitiveContains() throws Exception {
        // the owner from before() owns pet "Rosy"; search by mid-string + lowercase
        List<OwnerDto> owners = search("/api/owners?q=os");

        assertThat(owners)
            .extracting(OwnerDto::getId)
            .contains(ownerId);
    }

    @Test
    void search_matchesWildcardLiterally() throws Exception {
        // LIKE wildcards in the query must be treated as literal characters
        Owner percentOwner = TestData.anOwner();
        percentOwner.setLastName("100%Pure");
        int percentOwnerId = ownerRepository.save(percentOwner).getId();

        assertThat(searchByQuery("100%Pure"))
            .extracting(OwnerDto::getId)
            .contains(percentOwnerId);
        // a bare wildcard must NOT match this owner as if it were "match anything"
        assertThat(searchByQuery("XYZ%"))
            .extracting(OwnerDto::getId)
            .doesNotContain(percentOwnerId);
    }

    @Test
    void searchOwners_pagesAtDbLevel() {
        String marker = "zzpage";
        for (int i = 0; i < 5; i++) {
            ownerRepository.save(TestData.anOwner().setLastName(marker + i));
        }
        Page<Owner> page0 = ownerRepository.searchOwners(
            "%" + marker + "%", PageRequest.of(0, 2, Sort.by("firstName", "lastName")));

        assertThat(page0.getTotalElements()).isEqualTo(5);
        assertThat(page0.getTotalPages()).isEqualTo(3);
        assertThat(page0.getNumber()).isZero();
        assertThat(page0.getSize()).isEqualTo(2);
        assertThat(page0.getContent()).hasSize(2);
    }

    @Test
    void searchOwners_sortsByCityAscAndDesc() {
        String marker = "zzcity";
        ownerRepository.save(TestData.anOwner().setLastName(marker).setCity("Madrid"));
        ownerRepository.save(TestData.anOwner().setLastName(marker).setCity("Berlin"));
        ownerRepository.save(TestData.anOwner().setLastName(marker).setCity("Lisbon"));
        String pattern = "%" + marker + "%";

        Page<Owner> asc = ownerRepository.searchOwners(
            pattern, PageRequest.of(0, 10, Sort.by(Sort.Direction.ASC, "city")));
        assertThat(asc.getContent()).extracting(Owner::getCity)
            .containsExactly("Berlin", "Lisbon", "Madrid");

        Page<Owner> desc = ownerRepository.searchOwners(
            pattern, PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "city")));
        assertThat(desc.getContent()).extracting(Owner::getCity)
            .containsExactly("Madrid", "Lisbon", "Berlin");
    }

    @Test
    void list_returnsPageEnvelope_withDefaultSize10() throws Exception {
        mockMvc.perform(get("/api/owners"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content").isArray())
            .andExpect(jsonPath("$.number").value(0))
            .andExpect(jsonPath("$.size").value(10))
            .andExpect(jsonPath("$.totalElements").isNumber())
            .andExpect(jsonPath("$.totalPages").isNumber());
    }

    @Test
    void list_pagesWithExplicitPageAndSize() throws Exception {
        String marker = "zzctrlpage";
        for (int i = 0; i < 7; i++) {
            ownerRepository.save(TestData.anOwner().setLastName(marker + i));
        }
        mockMvc.perform(get("/api/owners").param("q", marker).param("page", "1").param("size", "5"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(7))
            .andExpect(jsonPath("$.number").value(1))
            .andExpect(jsonPath("$.size").value(5))
            .andExpect(jsonPath("$.content.length()").value(2));
    }

    @Test
    void list_sortsByName_firstThenLast() throws Exception {
        String marker = "zzname";
        ownerRepository.save(TestData.anOwner().setFirstName("Charlie").setLastName(marker));
        ownerRepository.save(TestData.anOwner().setFirstName("Alice").setLastName(marker));
        ownerRepository.save(TestData.anOwner().setFirstName("Bob").setLastName(marker));

        mockMvc.perform(get("/api/owners").param("q", marker).param("sort", "name,asc"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].firstName").value("Alice"))
            .andExpect(jsonPath("$.content[1].firstName").value("Bob"))
            .andExpect(jsonPath("$.content[2].firstName").value("Charlie"));
    }

    @Test
    void list_sortsByCity_ascAndDesc() throws Exception {
        String marker = "zzctrlcity";
        ownerRepository.save(TestData.anOwner().setLastName(marker).setCity("Madrid"));
        ownerRepository.save(TestData.anOwner().setLastName(marker).setCity("Berlin"));
        ownerRepository.save(TestData.anOwner().setLastName(marker).setCity("Lisbon"));

        mockMvc.perform(get("/api/owners").param("q", marker).param("sort", "city,asc"))
            .andExpect(jsonPath("$.content[0].city").value("Berlin"))
            .andExpect(jsonPath("$.content[2].city").value("Madrid"));
        mockMvc.perform(get("/api/owners").param("q", marker).param("sort", "city,desc"))
            .andExpect(jsonPath("$.content[0].city").value("Madrid"))
            .andExpect(jsonPath("$.content[2].city").value("Berlin"));
    }

    @Test
    void list_defaultOrder_isFirstNameThenLastName_whenSortOmitted() throws Exception {
        String marker = "zzdef";
        ownerRepository.save(TestData.anOwner().setFirstName("Zoe").setLastName(marker));
        ownerRepository.save(TestData.anOwner().setFirstName("Ann").setLastName(marker));

        mockMvc.perform(get("/api/owners").param("q", marker))
            .andExpect(jsonPath("$.content[0].firstName").value("Ann"))
            .andExpect(jsonPath("$.content[1].firstName").value("Zoe"));
    }

    @Test
    void list_nonSortableColumn_fallsBackToDefaultOrder() throws Exception {
        String marker = "zzfallback";
        ownerRepository.save(TestData.anOwner().setFirstName("Zoe").setLastName(marker));
        ownerRepository.save(TestData.anOwner().setFirstName("Ann").setLastName(marker));

        mockMvc.perform(get("/api/owners").param("q", marker).param("sort", "telephone,asc"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].firstName").value("Ann"))
            .andExpect(jsonPath("$.content[1].firstName").value("Zoe"));
    }

    @Test
    void list_searchSortAndPageCompose() throws Exception {
        String marker = "zzcompose";
        ownerRepository.save(TestData.anOwner().setLastName(marker).setCity("Madrid"));
        ownerRepository.save(TestData.anOwner().setLastName(marker).setCity("Berlin"));
        ownerRepository.save(TestData.anOwner().setLastName(marker).setCity("Lisbon"));
        ownerRepository.save(TestData.anOwner().setLastName("zzother").setCity("Amsterdam"));

        mockMvc.perform(get("/api/owners")
                .param("q", marker).param("sort", "city,asc").param("page", "0").param("size", "2"))
            .andExpect(jsonPath("$.totalElements").value(3))
            .andExpect(jsonPath("$.content.length()").value(2))
            .andExpect(jsonPath("$.content[0].city").value("Berlin"))
            .andExpect(jsonPath("$.content[1].city").value("Lisbon"));
    }

    // request the whole result set (size large enough to defeat paging) so these
    // "result contains X" assertions stay valid regardless of seed data and page slicing
    private List<OwnerDto> search(String uriTemplate) throws Exception {
        return parseOwners(mockMvc.perform(get(uriTemplate).param("size", "2000")));
    }

    private List<OwnerDto> searchByQuery(String q) throws Exception {
        return parseOwners(mockMvc.perform(get("/api/owners").param("q", q).param("size", "2000")));
    }

    private List<OwnerDto> parseOwners(ResultActions resultActions) throws Exception {
        String responseJson = resultActions
            .andExpect(status().isOk())
            .andExpect(content().contentType("application/json"))
            .andReturn()
            .getResponse()
            .getContentAsString();

        JsonNode content = mapper.readTree(responseJson).get("content");
        return mapper.convertValue(content, new TypeReference<List<OwnerDto>>() {
        });
    }

    @Test
    void getAllWithNameFilter_notFound() throws Exception {
        List<OwnerDto> results = search("/api/owners?q=NonExistent");

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
