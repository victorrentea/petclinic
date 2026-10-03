package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;

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
import org.springframework.test.web.servlet.RequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.transaction.Transactional;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.repository.OwnerRepository;

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerListTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    OwnerRepository ownerRepository;

    @Autowired
    JdbcTemplate jdbc;

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void envelopeHasExactlyContentAndTotalElements() throws Exception {
        JsonNode page = list("/api/owners");

        assertThat(page.isObject()).isTrue();
        List<String> fields = new ArrayList<>();
        page.fieldNames().forEachRemaining(fields::add);
        assertThat(fields).containsExactlyInAnyOrder("content", "totalElements");
    }

    @Test
    void defaultsToFirstTenByNameAscending() throws Exception {
        JsonNode page = list("/api/owners");

        assertThat(ids(page)).isEqualTo(idsFromDb("ORDER BY last_name, first_name, id LIMIT 10"));
        assertThat(page.path("totalElements").asLong()).isEqualTo(ownerRepository.count());
    }

    @Test
    void contentCarriesNestedPetsTypesAndVisits() throws Exception {
        JsonNode schroedinger = first(list("/api/owners?lastName=Schroedinger"));

        JsonNode milton = schroedinger.path("pets").get(0);
        assertThat(milton.path("name").asText()).isEqualTo("Milton");
        assertThat(milton.path("type").path("name").asText()).isEqualTo("cat");
        assertThat(milton.path("visits").isArray()).isTrue();
    }

    @ParameterizedTest
    @ValueSource(ints = {5, 10, 20})
    void acceptsPageSizes(int size) throws Exception {
        JsonNode page = list("/api/owners?size=" + size);

        assertThat(page.path("content")).hasSize((int) Math.min(size, ownerRepository.count()));
    }

    @Test
    void returnsTheRequestedPage() throws Exception {
        List<Integer> ids = saveOwners("Pagetest", 12);

        JsonNode page = list("/api/owners?lastName=Pagetest&page=1&size=5");

        assertThat(ids(page)).isEqualTo(ids.subList(5, 10));
        assertThat(page.path("totalElements").asLong()).isEqualTo(12);
    }

    @Test
    void pageBeyondTheLastIsEmptyButKeepsTheTotal() throws Exception {
        saveOwners("Pagetest", 3);

        JsonNode page = list("/api/owners?lastName=Pagetest&page=1&size=5");

        assertThat(page.path("content")).isEmpty();
        assertThat(page.path("totalElements").asLong()).isEqualTo(3);
    }

    @ParameterizedTest
    @ValueSource(strings = {"size=7", "size=0", "size=-5", "size=abc", "page=-1", "page=abc", "page=1.5",
            "page=99999999999"})
    void rejectsInvalidPaging(String query) throws Exception {
        mockMvc.perform(get("/api/owners?" + query))
                .andExpect(status().isBadRequest());
    }

    @ParameterizedTest
    @ValueSource(strings = {"lastName,asc", "telephone,asc", "name", "name,up", "city,", ",asc", "name,asc,city,desc"})
    void rejectsUnsupportedSort(String sort) throws Exception {
        mockMvc.perform(get("/api/owners").param("sort", sort))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsRepeatedSort() throws Exception {
        mockMvc.perform(get("/api/owners").param("sort", "name,asc", "city,desc"))
                .andExpect(status().isBadRequest());
    }

    @ParameterizedTest
    @ValueSource(strings = {"name,asc", "name,desc", "city,asc", "city,desc"})
    void acceptsBusinessSortKeys(String sort) throws Exception {
        mockMvc.perform(get("/api/owners").param("sort", sort))
                .andExpect(status().isOk());
    }

    @Test
    void filtersByCaseSensitiveLastNamePrefix() throws Exception {
        JsonNode potters = list("/api/owners?lastName=Pot");

        assertThat(potters.path("content").findValuesAsText("firstName")).containsExactlyInAnyOrder("Harry", "Beatrix");
        assertThat(potters.path("totalElements").asLong()).isEqualTo(2);
    }

    @ParameterizedTest
    @ValueSource(strings = {"otter", "Harry", "potter"})
    void prefixMatchesOnlyTheStartOfTheLastNameWithTheSameCase(String lastName) throws Exception {
        JsonNode page = list("/api/owners?lastName=" + lastName);

        assertThat(page.path("content")).isEmpty();
        assertThat(page.path("totalElements").asLong()).isZero();
    }

    @Test
    void emptyPrefixMatchesEveryOwner() throws Exception {
        JsonNode page = list("/api/owners?lastName=");

        assertThat(page.path("totalElements").asLong()).isEqualTo(ownerRepository.count());
    }

    @Test
    void pagesTheFilteredSet() throws Exception {
        saveOwners("Septet", 7);

        JsonNode page = list("/api/owners?lastName=Septet&size=5&page=1");

        assertThat(page.path("content")).hasSize(2);
        assertThat(page.path("totalElements").asLong()).isEqualTo(7);
    }

    @Test
    void matchesWildcardCharactersLiterally() throws Exception {
        int percent = saveOwner("Wild%card").getId();
        saveOwner("Wildxcard");
        int underscore = saveOwner("Wild_score").getId();
        saveOwner("Wildxscore");

        assertThat(ids(list(get("/api/owners").param("lastName", "Wild%")))).containsExactly(percent);
        assertThat(ids(list(get("/api/owners").param("lastName", "Wild_")))).containsExactly(underscore);
    }

    @ParameterizedTest
    @CsvSource({
            "name,asc,  'ORDER BY last_name, first_name, id'",
            "name,desc, 'ORDER BY last_name DESC, first_name DESC, id DESC'",
            "city,asc,  'ORDER BY city, last_name, first_name, id'",
            "city,desc, 'ORDER BY city DESC, last_name DESC, first_name DESC, id DESC'"})
    void traversingAllPagesFollowsTheSortChainWithoutDuplicatesOrGaps(String key, String direction, String orderBy)
            throws Exception {
        saveOwnersWithTiesAndSharedCities();

        List<Integer> traversed = new ArrayList<>();
        for (int page = 0; page < 3; page++) {
            traversed.addAll(ids(list(get("/api/owners").param("lastName", "Ord")
                    .param("size", "5").param("page", String.valueOf(page))
                    .param("sort", key + "," + direction))));
        }

        assertThat(traversed).isEqualTo(idsFromDb("WHERE last_name LIKE 'Ord%' " + orderBy));
    }

    @Test
    void identicalFullNamesAreOrderedByIdInTheRequestedDirection() throws Exception {
        List<Integer> twins = List.of(saveOwner("Twin", "Same").getId(), saveOwner("Twin", "Same").getId(),
                saveOwner("Twin", "Same").getId());

        assertThat(ids(list("/api/owners?lastName=Twin&sort=name,asc"))).isEqualTo(twins);
        assertThat(ids(list("/api/owners?lastName=Twin&sort=name,desc"))).isEqualTo(twins.reversed());
    }

    @Test
    void cityDescendingBreaksTiesByDescendingName() throws Exception {
        int ann = saveOwner("Citytie", "Ann", "Oslo").getId();
        int bob = saveOwner("Citytie", "Bob", "Oslo").getId();
        int zed = saveOwner("Citytie", "Zed", "Bergen").getId();

        assertThat(ids(list("/api/owners?lastName=Citytie&sort=city,desc"))).containsExactly(bob, ann, zed);
    }

    /** 12 owners: duplicate full names and shared cities straddling the 5-row page boundaries. */
    private void saveOwnersWithTiesAndSharedCities() {
        String[][] rows = {
                {"Ordb", "Ann", "Oslo"}, {"Ordb", "Ann", "Oslo"}, {"Orda", "Ann", "Bergen"},
                {"Ordb", "Ann", "Bergen"}, {"Ordc", "Bob", "Oslo"}, {"Orda", "Ann", "Oslo"},
                {"Ordc", "Bob", "Oslo"}, {"Ordb", "Cid", "Oslo"}, {"Orda", "Ann", "Bergen"},
                {"Ordd", "Dan", "Aarhus"}, {"Ordb", "Ann", "Oslo"}, {"Ordc", "Bob", "Bergen"}};
        for (String[] row : rows) {
            saveOwner(row[0], row[1], row[2]);
        }
    }

    private Owner saveOwner(String lastName, String firstName) {
        return saveOwner(lastName, firstName, "London");
    }

    private Owner saveOwner(String lastName, String firstName, String city) {
        Owner owner = TestData.anOwner();
        owner.setLastName(lastName);
        owner.setFirstName(firstName);
        owner.setCity(city);
        return ownerRepository.save(owner);
    }

    private List<Integer> saveOwners(String lastNamePrefix, int count) {
        // zero-padded so that name order equals insertion order
        return IntStream.range(0, count)
                .mapToObj(i -> saveOwner(lastNamePrefix + "%02d".formatted(i)).getId())
                .toList();
    }

    private Owner saveOwner(String lastName) {
        Owner owner = TestData.anOwner();
        owner.setLastName(lastName);
        return ownerRepository.save(owner);
    }

    private List<Integer> idsFromDb(String orderAndLimit) {
        return jdbc.queryForList("SELECT id FROM owners " + orderAndLimit, Integer.class);
    }

    private JsonNode list(String uri) throws Exception {
        return list(get(uri));
    }

    private JsonNode list(RequestBuilder request) throws Exception {
        String json = mockMvc.perform(request)
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(json);
    }

    private static JsonNode first(JsonNode page) {
        assertThat(page.path("content")).isNotEmpty();
        return page.path("content").get(0);
    }

    static List<Integer> ids(JsonNode page) {
        List<Integer> ids = new ArrayList<>();
        page.path("content").forEach(owner -> ids.add(owner.path("id").asInt()));
        return ids;
    }
}
