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
import org.springframework.jdbc.core.JdbcTemplate;
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

    @Autowired
    JdbcTemplate jdbc;

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
        List<OwnerDto> owners = search("/api/owners?lastName=Franklin");

        assertThat(owners)
                .extracting(OwnerDto::getId, OwnerDto::getFirstName, OwnerDto::getLastName)
                .contains(Assertions.tuple(ownerId, "George", "Franklin"));
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

    private JsonNode searchPage(String uriTemplate) throws Exception {
        String responseJson = mockMvc.perform(get(uriTemplate))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json"))
                .andReturn()
                .getResponse()
                .getContentAsString();

        return mapper.readTree(responseJson);
    }

    private List<OwnerDto> search(String uriTemplate) throws Exception {
        JsonNode content = searchPage(uriTemplate).get("content");
        return mapper.convertValue(content, new TypeReference<List<OwnerDto>>() {
        });
    }

    @Test
    void getAllWithNameFilter_notFound() throws Exception {
        List<OwnerDto> results = search("/api/owners?lastName=NonExistent");

        assertThat(results).isEmpty();
    }

    @Test
    void getAll_defaultsToPageZeroSizeTen() throws Exception {
        JsonNode page = searchPage("/api/owners");

        assertThat(page.get("number").asInt()).isEqualTo(0);
        assertThat(page.get("size").asInt()).isEqualTo(10);
        assertThat(page.get("content").size()).isLessThanOrEqualTo(10);
        assertThat(page.get("totalElements").asLong()).isGreaterThanOrEqualTo(page.get("content").size());
    }

    @Test
    void size21_isRejected() throws Exception {
        mockMvc.perform(get("/api/owners?size=21")).andExpect(status().isBadRequest());
    }

    @Test
    void size20_isAccepted() throws Exception {
        mockMvc.perform(get("/api/owners?size=20")).andExpect(status().isOk());
    }

    @Test
    void sortByName_isAccepted() throws Exception {
        mockMvc.perform(get("/api/owners?sort=name,asc")).andExpect(status().isOk());
    }

    @Test
    void size21_isRejected_withTheReasonInTheResponse() throws Exception {
        mockMvc.perform(get("/api/owners?size=21"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0]").value("Page size must not exceed 20"))
                .andExpect(jsonPath("$.detail").value("Page size must not exceed 20"));
    }

    @Test
    void unknownSortKey_isRejected_withTheReasonInTheResponse() throws Exception {
        mockMvc.perform(get("/api/owners?sort=doesNotExist,asc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0]").value(
                        org.hamcrest.Matchers.startsWith("Unsupported sort key 'doesNotExist'")));
    }

    // First names are deliberately out of step with the last names, so ordering by first name
    // first — or forcing first name ascending — produces a different sequence and fails.
    private void insertNameSortFixture() {
        insertOwner("SortProbeA", "Zoe", "Anytown");
        insertOwner("SortProbeA", "Adam", "Anytown");
        insertOwner("SortProbeB", "Bob", "Anytown");
    }

    @Test
    void sortByName_ordersByLastNameThenFirstName() throws Exception {
        insertNameSortFixture();

        List<String> ascending = firstNamesOfPage("SortProbe", 0, 10, "name,asc");

        assertThat(ascending).containsExactly("Adam", "Zoe", "Bob");
    }

    @Test
    void sortByNameDesc_reversesLastNameAndFirstNameTogether() throws Exception {
        insertNameSortFixture();

        List<String> descending = firstNamesOfPage("SortProbe", 0, 10, "name,desc");

        assertThat(descending).containsExactly("Bob", "Zoe", "Adam");
    }

    @Test
    void sortByCity_isAccepted() throws Exception {
        mockMvc.perform(get("/api/owners?sort=city,desc")).andExpect(status().isOk());
    }

    @Test
    void moreThanTwoSortKeys_areRejected() throws Exception {
        mockMvc.perform(get("/api/owners?sort=name,asc&sort=city,asc&sort=name,desc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0]").value("At most 2 sort keys may be requested"));
    }

    @Test
    void lastNameFilter_treatsPercentAsALiteralCharacter() throws Exception {
        String responseJson = mockMvc.perform(get("/api/owners").queryParam("lastName", "%"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        // an unescaped "%" would turn the prefix filter into a match-everything full scan
        assertThat(mapper.readTree(responseJson).get("totalElements").asLong()).isZero();
    }

    @Test
    void lastNameFilter_treatsUnderscoreAsALiteralCharacter() throws Exception {
        insertOwner("Underscore", "Uma", "Anytown");

        List<OwnerDto> owners = search("/api/owners?lastName=U_derscore");

        assertThat(owners).isEmpty();
    }

    @Test
    void sortByRawLastName_isRejected() throws Exception {
        mockMvc.perform(get("/api/owners?sort=lastName,asc")).andExpect(status().isBadRequest());
    }

    @Test
    void sortByRawFirstName_isRejected() throws Exception {
        mockMvc.perform(get("/api/owners?sort=firstName,asc")).andExpect(status().isBadRequest());
    }

    @Test
    void sortByRawId_isRejected() throws Exception {
        mockMvc.perform(get("/api/owners?sort=id,asc")).andExpect(status().isBadRequest());
    }

    @Test
    void sortByAddress_isRejected() throws Exception {
        mockMvc.perform(get("/api/owners?sort=address,asc")).andExpect(status().isBadRequest());
    }

    @Test
    void sortByTelephone_isRejected() throws Exception {
        mockMvc.perform(get("/api/owners?sort=telephone,asc")).andExpect(status().isBadRequest());
    }

    @Test
    void sortByPets_isRejected() throws Exception {
        mockMvc.perform(get("/api/owners?sort=pets,asc")).andExpect(status().isBadRequest());
    }

    @Test
    void sortByUnknownKey_isRejected() throws Exception {
        mockMvc.perform(get("/api/owners?sort=doesNotExist,asc")).andExpect(status().isBadRequest());
    }

    @Test
    void tiedAndNullSortValuesStayStableAndNonOverlappingAcrossPages() throws Exception {
        String prefix = "TieProbe";
        insertOwner(prefix + "1", "A", "SameCity");
        insertOwner(prefix + "2", "B", "SameCity");
        insertOwner(prefix + "3", "C", "SameCity");
        insertOwner(prefix + "4", "D", null);

        List<String> page0 = lastNamesOfPage(prefix, 0, 2, "city,asc");
        List<String> page1 = lastNamesOfPage(prefix, 1, 2, "city,asc");

        assertThat(page0).doesNotContainAnyElementsOf(page1);
        assertThat(page0).hasSize(2);
        assertThat(page1).hasSize(2);
        // owners with a null city are ordered last, regardless of the ascending direction requested
        assertThat(page1).last().isEqualTo(prefix + "4");
        // repeating the same request returns the same, stable order
        assertThat(lastNamesOfPage(prefix, 0, 2, "city,asc")).isEqualTo(page0);
    }

    @Test
    void nullSortValuesStayLastWhenSortingDescending() throws Exception {
        String prefix = "NullProbe";
        insertOwner(prefix + "1", "A", "Zzz-last-alphabetically");
        insertOwner(prefix + "2", "B", "Aaa-first-alphabetically");
        insertOwner(prefix + "3", "C", null);
        insertOwner(prefix + "4", "D", "Mmm-middle");

        List<String> descending = lastNamesOfPage(prefix, 0, 10, "city,desc");

        // without explicit NULLS LAST, Postgres' DESC default (NULLS FIRST) would put it first
        assertThat(descending).last().isEqualTo(prefix + "3");
    }

    private List<String> firstNamesOfPage(String lastNamePrefix, int page, int size, String sort) throws Exception {
        return ownersOfPage(lastNamePrefix, page, size, sort).stream().map(OwnerDto::getFirstName).toList();
    }

    private List<String> lastNamesOfPage(String lastNamePrefix, int page, int size, String sort) throws Exception {
        return ownersOfPage(lastNamePrefix, page, size, sort).stream().map(OwnerDto::getLastName).toList();
    }

    private List<OwnerDto> ownersOfPage(String lastNamePrefix, int page, int size, String sort) throws Exception {
        JsonNode content = searchPage("/api/owners?lastName=" + lastNamePrefix
                + "&page=" + page + "&size=" + size + "&sort=" + sort).get("content");
        return mapper.convertValue(content, new TypeReference<List<OwnerDto>>() {
        });
    }

    private void insertOwner(String lastName, String firstName, String city) {
        jdbc.update("INSERT INTO owners (first_name, last_name, address, city, telephone) "
                + "VALUES (?, ?, 'addr', ?, '0000000000')", firstName, lastName, city);
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
