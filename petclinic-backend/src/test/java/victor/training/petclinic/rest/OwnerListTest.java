package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.stream.StreamSupport;

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

/** GET /api/owners: page envelope, paging/sort inputs, and the preserved last-name filter. */
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
    void defaultRequest_returnsFirstTenByNameAscending_andTheTotal() throws Exception {
        JsonNode page = list(get("/api/owners"));

        assertThat(ids(page)).isEqualTo(jdbc.queryForList(
                "SELECT id FROM owners ORDER BY last_name, first_name, id LIMIT 10", Integer.class));
        assertThat(page.path("totalElements").asLong()).isEqualTo(ownerRepository.count());
    }

    @Test
    void envelopeHasExactlyContentAndTotalElements() throws Exception {
        JsonNode page = list(get("/api/owners"));

        assertThat(page.isObject()).isTrue();
        assertThat(page.fieldNames()).toIterable().containsExactlyInAnyOrder("content", "totalElements");
    }

    @Test
    void requestedPage_returnsPositionsSixToTen() throws Exception {
        JsonNode page = list(get("/api/owners").param("page", "1").param("size", "5"));

        assertThat(ids(page)).isEqualTo(jdbc.queryForList(
                "SELECT id FROM owners ORDER BY last_name, first_name, id OFFSET 5 LIMIT 5", Integer.class));
        assertThat(page.path("totalElements").asLong()).isEqualTo(ownerRepository.count());
    }

    @ParameterizedTest
    @ValueSource(ints = {5, 10, 20})
    void allowedSizes(int size) throws Exception {
        JsonNode page = list(get("/api/owners").param("size", String.valueOf(size)));

        assertThat(page.path("content")).hasSize(size);
    }

    @ParameterizedTest
    @ValueSource(strings = {"7", "0", "-5", "21", "abc", "10.5"})
    void invalidSize_isBadRequest(String size) throws Exception {
        mockMvc.perform(get("/api/owners").param("size", size))
                .andExpect(status().isBadRequest());
    }

    @ParameterizedTest
    @ValueSource(strings = {"-1", "abc", "1.5", "99999999999", "2147483647"})
    void invalidPage_isBadRequest(String page) throws Exception {
        mockMvc.perform(get("/api/owners").param("page", page).param("size", "20"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void pageBeyondTheLast_isEmpty_withTheActualTotal() throws Exception {
        JsonNode page = list(get("/api/owners").param("page", "100"));

        assertThat(page.path("content")).isEmpty();
        assertThat(page.path("totalElements").asLong()).isEqualTo(ownerRepository.count());
    }

    @Test
    void noMatch_isAnEmptyPage() throws Exception {
        JsonNode page = list(get("/api/owners").param("lastName", "NonExistent"));

        assertThat(page.path("content")).isEmpty();
        assertThat(page.path("totalElements").asLong()).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {"lastName,asc", "telephone,asc", "address,desc", "name", "name,up", "Name,asc",
            "name,ASC", "name,asc,city,asc", ",asc"})
    void unsupportedSort_isBadRequest(String sort) throws Exception {
        mockMvc.perform(get("/api/owners").param("sort", sort))
                .andExpect(status().isBadRequest());
    }

    @ParameterizedTest
    @ValueSource(strings = {"sort", "page", "size"})
    void rejectedInput_isNotEchoedBack(String parameter) throws Exception {
        String body = mockMvc.perform(get("/api/owners").param(parameter, "x\r\nFORGED LOG LINE"))
                .andExpect(status().isBadRequest())
                .andReturn().getResponse().getContentAsString();

        assertThat(body).doesNotContain("FORGED");
    }

    @Test
    void repeatedSortParameter_isBadRequest() throws Exception {
        mockMvc.perform(get("/api/owners").param("sort", "name,asc", "city,asc"))
                .andExpect(status().isBadRequest());
    }

    @ParameterizedTest
    @ValueSource(strings = {"name,asc", "name,desc", "city,asc", "city,desc"})
    void supportedSort_ordersByTheWholeChain(String sort) throws Exception {
        String direction = sort.endsWith("desc") ? " DESC" : "";
        String chain = (sort.startsWith("city") ? "city%1$s, " : "") + "last_name%1$s, first_name%1$s, id%1$s";
        JsonNode page = list(get("/api/owners").param("sort", sort).param("size", "20"));

        assertThat(ids(page)).isEqualTo(jdbc.queryForList(
                "SELECT id FROM owners ORDER BY " + chain.formatted(direction) + " LIMIT 20", Integer.class));
    }

    @Test
    void lastNamePrefix_isCaseSensitive_andAnchoredAtTheStart() throws Exception {
        assertThat(lastNames(list(get("/api/owners").param("lastName", "Pot"))))
                .containsExactly("Potter", "Potter");

        for (String nonMatching : List.of("otter", "Harry", "potter")) {
            assertThat(list(get("/api/owners").param("lastName", nonMatching)).path("totalElements").asLong())
                    .as(nonMatching).isZero();
        }
    }

    @Test
    void emptyLastName_matchesEveryOwner() throws Exception {
        JsonNode page = list(get("/api/owners").param("lastName", ""));

        assertThat(page.path("totalElements").asLong()).isEqualTo(ownerRepository.count());
    }

    @Test
    void filteredPage_countsOnlyTheMatches() throws Exception {
        for (int i = 1; i <= 7; i++) {
            saveOwner("Zz" + (char) ('A' + i) + "son");
        }

        JsonNode page = list(get("/api/owners").param("lastName", "Zz").param("size", "5").param("page", "1"));

        assertThat(lastNames(page)).containsExactly("ZzGson", "ZzHson");
        assertThat(page.path("totalElements").asLong()).isEqualTo(7);
    }

    @Test
    void wildcardCharactersInThePrefix_matchLiterally() throws Exception {
        saveOwner("Zz%Percent");
        saveOwner("ZzXPercent");
        saveOwner("Zz_Underscore");
        saveOwner("ZzXUnderscore");

        assertThat(lastNames(list(get("/api/owners").param("lastName", "Zz%")))).containsExactly("Zz%Percent");
        assertThat(lastNames(list(get("/api/owners").param("lastName", "Zz_")))).containsExactly("Zz_Underscore");
    }

    private void saveOwner(String lastName) {
        Owner owner = TestData.anOwner();
        owner.setLastName(lastName);
        ownerRepository.save(owner);
    }

    private JsonNode list(MockHttpServletRequestBuilder request) throws Exception {
        String json = mockMvc.perform(request)
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(json);
    }

    private static List<Integer> ids(JsonNode page) {
        return StreamSupport.stream(page.path("content").spliterator(), false)
                .map(o -> o.path("id").asInt())
                .toList();
    }

    private static List<String> lastNames(JsonNode page) {
        return StreamSupport.stream(page.path("content").spliterator(), false)
                .map(o -> o.path("lastName").asText())
                .toList();
    }
}
