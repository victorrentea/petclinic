package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
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

import jakarta.transaction.Transactional;

// The GET /api/owners page contract: envelope, defaults, bounds and the preserved prefix filter.
// Ordering across pages and the SQL budget live in OwnerListQueryTest.
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerListTest {

    @Autowired
    MockMvc mockMvc;
    @Autowired
    JdbcTemplate jdbc;

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void defaultRequest_returnsFirstTenByNameAndTheTotal() throws Exception {
        JsonNode page = getPage(get("/api/owners"));

        assertThat(page.isObject()).isTrue();
        assertThat(fieldNames(page)).containsExactlyInAnyOrder("content", "totalElements");
        assertThat(ids(page)).isEqualTo(idsByName(10, 0));
        assertThat(page.path("totalElements").asLong()).isEqualTo(ownerCount());
    }

    @Test
    void ownerDtosKeepTheirNestedPetsTypesAndVisits() throws Exception {
        JsonNode page = getPage(get("/api/owners").param("lastName", "Schroedinger"));

        JsonNode milton = page.path("content").get(0).path("pets").get(0);
        assertThat(milton.path("name").asText()).isEqualTo("Milton");
        assertThat(milton.path("type").path("name").asText()).isEqualTo("cat");
        assertThat(milton.path("visits").isArray()).isTrue();
    }

    @Test
    void requestedPage_returnsThoseOwnersAndTheFullTotal() throws Exception {
        JsonNode page = getPage(get("/api/owners").param("page", "1").param("size", "5"));

        assertThat(ids(page)).isEqualTo(idsByName(5, 5));
        assertThat(page.path("totalElements").asLong()).isEqualTo(ownerCount());
    }

    @ParameterizedTest
    @ValueSource(ints = {5, 10, 20})
    void allowedPageSizes(int size) throws Exception {
        JsonNode page = getPage(get("/api/owners").param("size", String.valueOf(size)));

        assertThat(page.path("content").size()).isEqualTo(size);
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "size | 7",
            "size | 0",
            "size | -5",
            "size | abc",
            "page | -1",
            "page | abc",
            "page | 1.5",
            "page | 99999999999",
            "page | 2147483647",
            "sort | lastName,asc",
            "sort | telephone,asc",
            "sort | name",
            "sort | name,up",
            "sort | name,asc,city,asc",
    })
    void invalidPagingOrSort_isRejected(String param, String value) throws Exception {
        mockMvc.perform(get("/api/owners").param(param, value))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation Error"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"name,asc", "name,desc", "city,asc", "city,desc"})
    void supportedSorts_areAccepted(String sort) throws Exception {
        getPage(get("/api/owners").param("sort", sort));
    }

    @Test
    void pageBeyondTheLast_isEmptyButKeepsTheTotal() throws Exception {
        JsonNode page = getPage(get("/api/owners").param("page", "1000"));

        assertThat(page.path("content").isEmpty()).isTrue();
        assertThat(page.path("totalElements").asLong()).isEqualTo(ownerCount());
    }

    @Test
    void emptyLastName_matchesEveryOwner() throws Exception {
        JsonNode page = getPage(get("/api/owners").param("lastName", ""));

        assertThat(page.path("totalElements").asLong()).isEqualTo(ownerCount());
    }

    @Test
    void lastNamePrefix_isCaseSensitive() throws Exception {
        assertThat(lastNames(getPage(get("/api/owners").param("lastName", "Pot"))))
                .containsExactly("Potter", "Potter");
        for (String nonMatching : List.of("otter", "Harry", "potter")) {
            JsonNode page = getPage(get("/api/owners").param("lastName", nonMatching));
            assertThat(page.path("totalElements").asLong()).as(nonMatching).isZero();
        }
    }

    @Test
    void filteredPage_countsOnlyTheMatches() throws Exception {
        IntStream.range(0, 7).forEach(i -> insertOwner("Ann" + (char) ('a' + i), "Septuplet"));

        JsonNode page = getPage(get("/api/owners").param("lastName", "Septup").param("size", "5").param("page", "1"));

        assertThat(page.path("content").size()).isEqualTo(2);
        assertThat(page.path("totalElements").asLong()).isEqualTo(7);
    }

    @ParameterizedTest
    @CsvSource({"Pe%, Pe%rcent, Pexrcent", "Un_, Un_der, Unxder"})
    void wildcardCharacters_matchLiterally(String prefix, String literal, String wildcardOnly) throws Exception {
        insertOwner("Ann", literal);
        insertOwner("Ann", wildcardOnly);

        assertThat(lastNames(getPage(get("/api/owners").param("lastName", prefix)))).containsExactly(literal);
    }

    private JsonNode getPage(MockHttpServletRequestBuilder request) throws Exception {
        String json = mockMvc.perform(request)
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json"))
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(json);
    }

    private static List<String> fieldNames(JsonNode node) {
        List<String> names = new ArrayList<>();
        node.fieldNames().forEachRemaining(names::add);
        return names;
    }

    private static List<Integer> ids(JsonNode page) {
        return topLevel(page, "id").stream().map(Integer::valueOf).toList();
    }

    private static List<String> lastNames(JsonNode page) {
        return topLevel(page, "lastName");
    }

    private static List<String> topLevel(JsonNode page, String field) {
        List<String> values = new ArrayList<>();
        page.path("content").forEach(owner -> values.add(owner.path(field).asText()));
        return values;
    }

    private List<Integer> idsByName(int limit, int offset) {
        return jdbc.queryForList("SELECT id FROM owners ORDER BY last_name, first_name, id LIMIT ? OFFSET ?",
                Integer.class, limit, offset);
    }

    private long ownerCount() {
        return jdbc.queryForObject("SELECT count(*) FROM owners", Long.class);
    }

    private void insertOwner(String firstName, String lastName) {
        jdbc.update("INSERT INTO owners (first_name, last_name, address, city, telephone)"
                + " VALUES (?, ?, 'addr', 'city', '0000000000')", firstName, lastName);
    }
}
