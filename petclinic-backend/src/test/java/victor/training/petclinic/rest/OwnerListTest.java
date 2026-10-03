package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.StreamSupport;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.PetType;
import victor.training.petclinic.domain.Visit;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.PetTypeRepository;
import victor.training.petclinic.repository.VisitRepository;

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerListTest {
    private static final String NAME_ORDER = "last_name, first_name, id";

    @Autowired
    MockMvc mockMvc;
    @Autowired
    JdbcTemplate jdbc;
    @Autowired
    OwnerRepository ownerRepository;
    @Autowired
    PetRepository petRepository;
    @Autowired
    PetTypeRepository petTypeRepository;
    @Autowired
    VisitRepository visitRepository;
    @Autowired
    EntityManager entityManager;

    final ObjectMapper mapper = new ObjectMapper();

    // 7 owners sharing the prefix "Zpg": a duplicate full name, shared cities, all without pets
    int annBath1, annBath2, bobCork, annZpgbBath, cidAvon, danCork, eveAvon;

    @BeforeEach
    void persistOwnersSharingAPrefix() {
        annBath1 = owner("Ann", "Zpga", "Bath");
        annBath2 = owner("Ann", "Zpga", "Bath");
        bobCork = owner("Bob", "Zpga", "Cork");
        annZpgbBath = owner("Ann", "Zpgb", "Bath");
        cidAvon = owner("Cid", "Zpgc", "Avon");
        danCork = owner("Dan", "Zpgd", "Cork");
        eveAvon = owner("Eve", "Zpge", "Avon");
    }

    @Test
    void defaultRequest_returnsTheFirstTenByNameWithTheTotal() throws Exception {
        JsonNode page = list(get("/api/owners"));

        assertThat(ids(page)).containsExactlyElementsOf(idsInSql(NAME_ORDER, 0, 10));
        assertThat(page.path("totalElements").asLong()).isEqualTo(ownerRepository.count());
    }

    @Test
    void envelope_hasExactlyContentAndTotalElements() throws Exception {
        JsonNode page = list(get("/api/owners"));

        assertThat(page.isObject()).isTrue();
        List<String> fields = new ArrayList<>();
        page.fieldNames().forEachRemaining(fields::add);
        assertThat(fields).containsExactlyInAnyOrder("content", "totalElements");
        assertThat(page.path("content").isArray()).isTrue();
    }

    @Test
    void requestedPage_skipsTheEarlierPages() throws Exception {
        JsonNode page = list(get("/api/owners").param("page", "1").param("size", "5"));

        assertThat(ids(page)).containsExactlyElementsOf(idsInSql(NAME_ORDER, 5, 5));
        assertThat(page.path("totalElements").asLong()).isEqualTo(ownerRepository.count());
    }

    @ParameterizedTest
    @ValueSource(ints = {5, 10, 20})
    void allowedSizes(int size) throws Exception {
        JsonNode page = list(get("/api/owners").param("size", String.valueOf(size)));

        assertThat(ids(page)).containsExactlyElementsOf(idsInSql(NAME_ORDER, 0, size));
    }

    @ParameterizedTest
    @CsvSource({
            "size, 7",
            "size, 0",
            "size, -5",
            "size, abc",
            "page, -1",
            "page, abc",
            "page, 1.5",
            "page, 99999999999",
            "page, 2147483647", // page * size does not fit the database offset
            "sort, lastName,asc",
            "sort, telephone,asc",
            "sort, name",
            "sort, name,up",
            "sort, name,ASC",
            "sort, name,asc,city,desc",
    })
    void invalidInput_isRejected(String param, String value) throws Exception {
        mockMvc.perform(get("/api/owners").param(param, value))
                .andExpect(status().isBadRequest());
    }

    @Test
    void repeatedSort_isRejected() throws Exception {
        mockMvc.perform(get("/api/owners").param("sort", "name,asc").param("sort", "city,desc"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void pageBeyondTheLast_isEmptyWithTheRealTotal() throws Exception {
        JsonNode page = list(get("/api/owners").param("lastName", "Zpg").param("page", "5").param("size", "5"));

        assertThat(page.path("content")).isEmpty();
        assertThat(page.path("totalElements").asLong()).isEqualTo(7);
    }

    @Test
    void filteredPage_countsTheWholeFilteredSet() throws Exception {
        JsonNode page = list(get("/api/owners").param("lastName", "Zpg").param("page", "1").param("size", "5"));

        assertThat(ids(page)).containsExactly(danCork, eveAvon);
        assertThat(page.path("totalElements").asLong()).isEqualTo(7);
    }

    @Test
    void noMatch_isAnEmptyPage() throws Exception {
        JsonNode page = list(get("/api/owners").param("lastName", "NonExistent"));

        assertThat(page.path("content")).isEmpty();
        assertThat(page.path("totalElements").asLong()).isZero();
    }

    @Test
    void emptyLastName_matchesEveryone() throws Exception {
        JsonNode page = list(get("/api/owners").param("lastName", ""));

        assertThat(page.path("totalElements").asLong()).isEqualTo(ownerRepository.count());
    }

    @Test
    void lastNamePrefix_isCaseSensitive() throws Exception {
        assertThat(lastNames(list(get("/api/owners").param("lastName", "Pot"))))
                .isNotEmpty().allMatch(lastName -> lastName.startsWith("Pot")).contains("Potter");
        assertThat(totalFor("otter")).isZero();
        assertThat(totalFor("Harry")).isZero();
        assertThat(totalFor("potter")).isZero();
    }

    @Test
    void lastNamePrefix_treatsSqlWildcardsLiterally() throws Exception {
        int percent = owner("Pc", "Zw%x", "Bath");
        int underscore = owner("Us", "Zw_y", "Bath");
        owner("Plain", "Zwaz", "Bath");

        assertThat(ids(list(get("/api/owners").param("lastName", "Zw%")))).containsExactly(percent);
        assertThat(ids(list(get("/api/owners").param("lastName", "Zw_")))).containsExactly(underscore);
    }

    @Test
    void nameAscending_breaksTiesById_acrossPageBoundaries() throws Exception {
        assertThat(traverse("name,asc"))
                .containsExactly(annBath1, annBath2, bobCork, annZpgbBath, cidAvon, danCork, eveAvon);
    }

    @Test
    void nameDescending_reversesTheWholeChain() throws Exception {
        assertThat(traverse("name,desc"))
                .containsExactly(eveAvon, danCork, cidAvon, annZpgbBath, bobCork, annBath2, annBath1);
    }

    @Test
    void cityAscending_thenName_thenId() throws Exception {
        assertThat(traverse("city,asc"))
                .containsExactly(cidAvon, eveAvon, annBath1, annBath2, annZpgbBath, bobCork, danCork);
    }

    @Test
    void cityDescending_reversesTheWholeChain() throws Exception {
        assertThat(traverse("city,desc"))
                .containsExactly(danCork, bobCork, annZpgbBath, annBath2, annBath1, eveAvon, cidAvon);
    }

    @Test
    void listedOwner_carriesTheSameNestedDataAsItsDetail() throws Exception {
        int withPets = owner("Fay", "Zpgf", "Bath");
        PetType hamster = petTypeRepository.save(TestData.aPetType("zp-hamster"));
        PetType parrot = petTypeRepository.save(TestData.aPetType("zp-parrot"));
        pet(withPets, "Alpha", hamster, "check-up", "vaccine");
        pet(withPets, "Beta", parrot, "wing clip");
        entityManager.flush();
        entityManager.clear();

        JsonNode page = list(get("/api/owners").param("lastName", "Zpgf"));
        JsonNode detail = json(get("/api/owners/{id}", withPets));

        assertThat(page.path("content")).hasSize(1);
        assertThat(page.path("content").get(0)).isEqualTo(detail);
        assertThat(detail.path("pets")).hasSize(2);
    }

    @Test
    void ownersWithoutPets_areListedWithAnEmptyPetList() throws Exception {
        JsonNode page = list(get("/api/owners").param("lastName", "Zpge"));

        assertThat(page.path("content").get(0).path("pets")).isEmpty();
    }

    private List<Integer> traverse(String sort) throws Exception {
        List<Integer> all = new ArrayList<>();
        for (int pageIndex = 0; pageIndex < 2; pageIndex++) {
            all.addAll(ids(list(get("/api/owners").param("lastName", "Zpg")
                    .param("sort", sort).param("size", "5").param("page", String.valueOf(pageIndex)))));
        }
        return all;
    }

    private long totalFor(String lastName) throws Exception {
        return list(get("/api/owners").param("lastName", lastName)).path("totalElements").asLong();
    }

    private JsonNode list(MockHttpServletRequestBuilder request) throws Exception {
        JsonNode page = json(request);
        assertThat(page.has("content") && page.has("totalElements")).as("a page envelope: " + page).isTrue();
        return page;
    }

    private JsonNode json(MockHttpServletRequestBuilder request) throws Exception {
        String body = mockMvc.perform(request)
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(body);
    }

    private static List<Integer> ids(JsonNode page) {
        return StreamSupport.stream(page.path("content").spliterator(), false)
                .map(owner -> owner.path("id").asInt())
                .toList();
    }

    private static List<String> lastNames(JsonNode page) {
        return StreamSupport.stream(page.path("content").spliterator(), false)
                .map(owner -> owner.path("lastName").asText())
                .toList();
    }

    private List<Integer> idsInSql(String orderBy, int offset, int limit) {
        return jdbc.queryForList("SELECT id FROM owners ORDER BY " + orderBy + " OFFSET ? LIMIT ?",
                Integer.class, offset, limit);
    }

    private int owner(String firstName, String lastName, String city) {
        Owner owner = TestData.anOwner();
        owner.setFirstName(firstName);
        owner.setLastName(lastName);
        owner.setCity(city);
        return ownerRepository.save(owner).getId();
    }

    private void pet(int ownerId, String name, PetType type, String... visitDescriptions) {
        Pet pet = TestData.aPet();
        pet.setName(name);
        pet.setType(type);
        pet.setOwner(ownerRepository.findById(ownerId).orElseThrow());
        petRepository.save(pet);
        for (String description : visitDescriptions) {
            Visit visit = new Visit();
            visit.setDate(LocalDate.of(2024, 1, 1));
            visit.setDescription(description);
            visit.setPet(pet);
            visitRepository.save(visit);
        }
    }
}
