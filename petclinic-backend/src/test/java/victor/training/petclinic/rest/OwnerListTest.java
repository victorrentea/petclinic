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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.transaction.Transactional;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.repository.OwnerRepository;

/** The paged contract of GET /api/owners: envelope, paging inputs, sort keys and the preserved prefix filter. */
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
    void defaultRequest_returnsFirstTenByNameAndTheTotal() throws Exception {
        JsonNode page = getOk("/api/owners");

        assertThat(fieldNames(page)).containsExactlyInAnyOrder("content", "totalElements");
        assertThat(page.path("totalElements").asLong())
                .isEqualTo(jdbc.queryForObject("SELECT count(*) FROM owners", Long.class));
        assertThat(ids(page)).containsExactlyElementsOf(jdbc.queryForList(
                "SELECT id FROM owners ORDER BY last_name, first_name, id LIMIT 10", Integer.class));
    }

    @Test
    void ownerDtosKeepTheirNestedPetsTypesAndVisits() throws Exception {
        JsonNode page = getOk("/api/owners?lastName=Liddell");

        JsonNode alice = page.path("content").get(0);
        assertThat(alice.path("pets")).hasSize(2);
        JsonNode dinah = alice.path("pets").get(1).path("name").asText().equals("Dinah")
                ? alice.path("pets").get(1)
                : alice.path("pets").get(0);
        assertThat(dinah.path("type").path("name").asText()).isEqualTo("cat");
        assertThat(dinah.path("visits")).isNotEmpty();
        assertThat(dinah.path("visits").get(0).path("description").asText()).isEqualTo("rabies shot");
    }

    @Test
    void ownersWithoutPetsAreListed() throws Exception {
        saveOwner("Petless", "Pat");

        JsonNode page = getOk("/api/owners?lastName=Petless");

        assertThat(page.path("content")).hasSize(1);
        assertThat(page.path("content").get(0).path("pets")).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(ints = {5, 10, 20})
    void acceptsSizes(int size) throws Exception {
        JsonNode page = getOk("/api/owners?size=" + size);

        assertThat(page.path("content")).hasSize(size);
    }

    @Test
    void requestedPage_returnsThatSliceOfTheOrdering() throws Exception {
        JsonNode page = getOk("/api/owners?page=1&size=5");

        assertThat(ids(page)).containsExactlyElementsOf(jdbc.queryForList(
                "SELECT id FROM owners ORDER BY last_name, first_name, id LIMIT 5 OFFSET 5", Integer.class));
        assertThat(page.path("totalElements").asLong())
                .isEqualTo(jdbc.queryForObject("SELECT count(*) FROM owners", Long.class));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "size=7", "size=0", "size=-5", "size=abc", "size=",
            "page=-1", "page=abc", "page=1.5", "page=", "page=99999999999", "page=2147483647",
    })
    void rejectsInvalidPaging(String query) throws Exception {
        mockMvc.perform(get("/api/owners?" + query))
                .andExpect(status().isBadRequest());
    }

    @Test
    void pageBeyondTheLast_isEmptyWithTheRealTotal() throws Exception {
        JsonNode page = getOk("/api/owners?page=1000&size=20");

        assertThat(page.path("content")).isEmpty();
        assertThat(page.path("totalElements").asLong())
                .isEqualTo(jdbc.queryForObject("SELECT count(*) FROM owners", Long.class));
    }

    @Test
    void cityDescending_ordersTheWholeChainDescending() throws Exception {
        JsonNode page = getOk("/api/owners?sort=city,desc&size=20");

        assertThat(ids(page)).containsExactlyElementsOf(jdbc.queryForList(
                "SELECT id FROM owners ORDER BY city DESC, last_name DESC, first_name DESC, id DESC LIMIT 20",
                Integer.class));
    }

    @Test
    void nameDescending() throws Exception {
        JsonNode page = getOk("/api/owners?sort=name,desc");

        assertThat(ids(page)).containsExactlyElementsOf(jdbc.queryForList(
                "SELECT id FROM owners ORDER BY last_name DESC, first_name DESC, id DESC LIMIT 10",
                Integer.class));
    }

    @Test
    void cityAscending() throws Exception {
        JsonNode page = getOk("/api/owners?sort=city,asc");

        assertThat(ids(page)).containsExactlyElementsOf(jdbc.queryForList(
                "SELECT id FROM owners ORDER BY city, last_name, first_name, id LIMIT 10", Integer.class));
    }

    @Test
    void explicitNameAscending_equalsTheDefault() throws Exception {
        assertThat(ids(getOk("/api/owners?sort=name,asc"))).isEqualTo(ids(getOk("/api/owners")));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "sort=lastName,asc", "sort=telephone,asc", "sort=name", "sort=name,up", "sort=",
            "sort=name,asc,city", "sort=NAME,asc", "sort=name,asc&sort=city,asc",
    })
    void rejectsUnsupportedSort(String query) throws Exception {
        mockMvc.perform(get("/api/owners?" + query))
                .andExpect(status().isBadRequest());
    }

    @Test
    void prefixFilterIsCaseSensitiveAndAnchoredAtTheStart() throws Exception {
        assertThat(lastNames(getOk("/api/owners?lastName=Pot"))).containsOnly("Potter").hasSize(2);
        assertThat(getOk("/api/owners?lastName=otter").path("content")).isEmpty();
        assertThat(getOk("/api/owners?lastName=Harry").path("content")).isEmpty();
        assertThat(getOk("/api/owners?lastName=potter").path("content")).isEmpty();
    }

    @Test
    void emptyPrefixMatchesAllOwners() throws Exception {
        assertThat(getOk("/api/owners?lastName=").path("totalElements").asLong())
                .isEqualTo(jdbc.queryForObject("SELECT count(*) FROM owners", Long.class));
    }

    @Test
    void filteredPage_countsOnlyTheMatches() throws Exception {
        for (int i = 0; i < 7; i++) {
            saveOwner("Seventh" + i, "Kim");
        }

        JsonNode page = getOk("/api/owners?lastName=Seventh&size=5&page=1");

        assertThat(page.path("content")).hasSize(2);
        assertThat(page.path("totalElements").asLong()).isEqualTo(7);
    }

    @Test
    void percentAndUnderscoreAreMatchedLiterally() throws Exception {
        saveOwner("Pct%Literal", "Ann");
        saveOwner("PctXLiteral", "Bob");
        saveOwner("Und_Literal", "Cid");
        saveOwner("UndXLiteral", "Dan");

        assertThat(lastNames(getOk(get("/api/owners").param("lastName", "Pct%")))).containsExactly("Pct%Literal");
        assertThat(lastNames(getOk(get("/api/owners").param("lastName", "Und_")))).containsExactly("Und_Literal");
    }

    private void saveOwner(String lastName, String firstName) {
        Owner owner = TestData.anOwner();
        owner.setLastName(lastName);
        owner.setFirstName(firstName);
        ownerRepository.save(owner);
    }

    private JsonNode getOk(String uri) throws Exception {
        return getOk(get(uri));
    }

    private JsonNode getOk(MockHttpServletRequestBuilder request) throws Exception {
        String json = mockMvc.perform(request)
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode body = mapper.readTree(json);
        assertThat(body.isObject()).as("page envelope, not a bare array").isTrue();
        return body;
    }

    private static List<String> fieldNames(JsonNode node) {
        List<String> names = new ArrayList<>();
        node.fieldNames().forEachRemaining(names::add);
        return names;
    }

    private static List<Integer> ids(JsonNode page) {
        List<Integer> ids = new ArrayList<>();
        page.path("content").forEach(o -> ids.add(o.path("id").asInt()));
        return ids;
    }

    private static List<String> lastNames(JsonNode page) {
        List<String> names = new ArrayList<>();
        page.path("content").forEach(o -> names.add(o.path("lastName").asText()));
        return names;
    }
}
