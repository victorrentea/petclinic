package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.transaction.Transactional;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.repository.OwnerRepository;

/** The paged contract of GET /api/owners, against the 26 seeded owners plus a few of its own. */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerListTest {
    private static final int SEEDED_OWNERS = 26;

    @Autowired
    MockMvc mockMvc;
    @Autowired
    OwnerRepository ownerRepository;

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void defaultRequest_firstTenByNameAscending_withTotal() throws Exception {
        JsonNode page = list("/api/owners");

        assertThat(fieldNames(page)).containsExactlyInAnyOrder("content", "totalElements");
        assertThat(page.path("totalElements").asLong()).isEqualTo(SEEDED_OWNERS);
        assertThat(lastNames(page)).hasSize(10)
                .containsExactly("Baskerville", "Carraclough", "Darling", "Darling", "Dickens",
                        "Dolittle", "Filch", "Geppetto", "Granger", "Hagrid");
        assertThat(firstNames(page).subList(2, 4)).containsExactly("George", "Wendy");
    }

    @Test
    void contentCarriesNestedPetsTypesAndVisits() throws Exception {
        JsonNode alice = list("/api/owners?lastName=Liddell").path("content").get(0);

        assertThat(alice.path("pets")).hasSize(2);
        JsonNode cheshire = alice.path("pets").get(0);
        assertThat(cheshire.path("name").asText()).isEqualTo("Cheshire");
        assertThat(cheshire.path("type").path("name").asText()).isEqualTo("cat");
        assertThat(cheshire.path("visits")).hasSize(2);
    }

    @Test
    void ownersWithoutPetsAreListed() throws Exception {
        saveOwner("Petless", "Zpetless");

        JsonNode page = list("/api/owners?lastName=Zpetless");

        assertThat(firstNames(page)).containsExactly("Petless");
        assertThat(page.path("content").get(0).path("pets")).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(ints = {5, 10, 20})
    void allowedSizes(int size) throws Exception {
        JsonNode page = list("/api/owners?size=" + size);

        assertThat(page.path("content")).hasSize(size);
        assertThat(page.path("totalElements").asLong()).isEqualTo(SEEDED_OWNERS);
    }

    @Test
    void secondPageOfFive_isPositionsSixToTen() throws Exception {
        List<String> firstTen = lastNames(list("/api/owners?size=10"));

        JsonNode page = list("/api/owners?page=1&size=5");

        assertThat(lastNames(page)).isEqualTo(firstTen.subList(5, 10));
        assertThat(page.path("totalElements").asLong()).isEqualTo(SEEDED_OWNERS);
    }

    @Test
    void lastPartialPage() throws Exception {
        JsonNode page = list("/api/owners?page=5&size=5");

        assertThat(page.path("content")).hasSize(1);
        assertThat(page.path("totalElements").asLong()).isEqualTo(SEEDED_OWNERS);
    }

    @Test
    void pageBeyondTheLast_isEmptyWithActualTotal() throws Exception {
        JsonNode page = list("/api/owners?page=99&size=20");

        assertThat(page.path("content")).isEmpty();
        assertThat(page.path("totalElements").asLong()).isEqualTo(SEEDED_OWNERS);
    }

    @Test
    void noMatch_isEmptyWithZeroTotal() throws Exception {
        JsonNode page = list("/api/owners?lastName=NonExistent");

        assertThat(page.path("content")).isEmpty();
        assertThat(page.path("totalElements").asLong()).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "size=7", "size=0", "size=-5", "size=abc",
            "page=-1", "page=abc", "page=1.5", "page=99999999999", "page=2147483647&size=20",
            "sort=lastName,asc", "sort=telephone,asc", "sort=name", "sort=name,up",
            "sort=name,asc,city", "sort=NAME,asc", "sort=name,asc&sort=city,asc"})
    void invalidParameters_400(String query) throws Exception {
        mockMvc.perform(get("/api/owners?" + query))
                .andExpect(status().isBadRequest());
    }

    @ParameterizedTest
    @ValueSource(strings = {"name,asc", "name,desc", "city,asc", "city,desc"})
    void allowedSorts(String sort) throws Exception {
        JsonNode page = list("/api/owners?sort=" + sort);

        assertThat(page.path("content")).hasSize(10);
    }

    @Test
    void nameDescending_startsFromTheEndOfNameAscending() throws Exception {
        List<String> lastPageAscending = lastNames(list("/api/owners?page=5&size=5"));
        lastPageAscending.addAll(0, lastNames(list("/api/owners?page=4&size=5")).subList(1, 5));

        JsonNode page = list("/api/owners?sort=name,desc&size=5");

        assertThat(lastNames(page)).containsExactlyElementsOf(lastPageAscending.reversed());
    }

    @Test
    void cityAscending_tiesByLastNameFirstName() throws Exception {
        JsonNode page = list("/api/owners?sort=city,asc&size=20");

        List<String> cities = new ArrayList<>();
        page.path("content").forEach(o -> cities.add(o.path("city").asText()));
        assertThat(cities).isSortedAccordingTo(String::compareTo);
        int london = cities.indexOf("London");
        assertThat(firstNames(page).subList(london, london + 5))
                .containsExactly("George", "Wendy", "Sherlock", "Roger", "Newt");
    }

    @Test
    void prefixIsCaseSensitiveAndAnchoredToLastNameStart() throws Exception {
        assertThat(firstNames(list("/api/owners?lastName=Pot"))).containsExactly("Beatrix", "Harry");
        assertThat(list("/api/owners?lastName=Pot").path("totalElements").asLong()).isEqualTo(2);
        for (String noMatch : List.of("otter", "Harry", "potter")) {
            assertThat(list("/api/owners?lastName=" + noMatch).path("totalElements").asLong())
                    .as(noMatch).isZero();
        }
    }

    @Test
    void emptyPrefix_matchesAll() throws Exception {
        assertThat(list("/api/owners?lastName=").path("totalElements").asLong()).isEqualTo(SEEDED_OWNERS);
    }

    @Test
    void filteredSecondPage_countsOnlyMatches() throws Exception {
        for (int i = 1; i <= 7; i++) {
            saveOwner("Seven" + i, "Zed");
        }

        JsonNode page = list("/api/owners?lastName=Zed&size=5&page=1");

        assertThat(firstNames(page)).containsExactly("Seven6", "Seven7");
        assertThat(page.path("totalElements").asLong()).isEqualTo(7);
    }

    @Test
    void wildcardCharactersMatchLiterally() throws Exception {
        saveOwner("Percent", "Zq%x");
        saveOwner("Underscore", "Zq_x");
        saveOwner("Plain", "Zqax");

        assertThat(firstNames(listByLastName("Zq%"))).containsExactly("Percent");
        assertThat(firstNames(listByLastName("Zq_"))).containsExactly("Underscore");
    }

    private void saveOwner(String firstName, String lastName) {
        Owner owner = TestData.anOwner();
        owner.setFirstName(firstName);
        owner.setLastName(lastName);
        ownerRepository.save(owner);
    }

    private JsonNode listByLastName(String lastName) throws Exception {
        return list(get("/api/owners").param("lastName", lastName));
    }

    private JsonNode list(String uri) throws Exception {
        return list(get(uri));
    }

    private JsonNode list(MockHttpServletRequestBuilder request) throws Exception {
        String json = mockMvc.perform(request)
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(json);
    }

    private static List<String> fieldNames(JsonNode page) {
        assertThat(page.isObject()).as("page envelope is a JSON object").isTrue();
        List<String> names = new ArrayList<>();
        page.fieldNames().forEachRemaining(names::add);
        return names;
    }

    private static List<String> lastNames(JsonNode page) {
        return column(page, "lastName");
    }

    private static List<String> firstNames(JsonNode page) {
        return column(page, "firstName");
    }

    private static List<String> column(JsonNode page, String field) {
        List<String> values = new ArrayList<>();
        page.path("content").forEach(owner -> values.add(owner.path(field).asText()));
        return values;
    }
}
