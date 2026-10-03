package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.stream.IntStream;
import java.util.stream.StreamSupport;

import org.assertj.core.groups.Tuple;
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
import jakarta.transaction.Transactional;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.repository.OwnerRepository;

/** The page contract of GET /api/owners: envelope, defaults, bounds and the preserved last-name filter. */
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
        List<Integer> firstTenByName = jdbc.queryForList(
                "SELECT id FROM owners ORDER BY last_name, first_name, id LIMIT 10", Integer.class);

        JsonNode page = list(get("/api/owners"));

        assertThat(ids(page)).containsExactlyElementsOf(firstTenByName);
        assertThat(page.path("totalElements").asLong()).isEqualTo(ownerRepository.count());
    }

    @Test
    void envelopeHasExactlyContentAndTotalElements() throws Exception {
        JsonNode page = list(get("/api/owners"));

        assertThat(page.isObject()).isTrue();
        assertThat(page.fieldNames()).toIterable().containsExactlyInAnyOrder("content", "totalElements");
        assertThat(page.path("content").isArray()).isTrue();
    }

    @Test
    void ownerInContentKeepsItsNestedPets() throws Exception {
        JsonNode page = list(get("/api/owners").param("lastName", "Schroedinger"));

        JsonNode pet = page.path("content").get(0).path("pets").get(0);
        assertThat(pet.path("name").asText()).isEqualTo("Milton");
        assertThat(pet.path("type").path("name").asText()).isNotBlank();
        assertThat(pet.path("visits").isArray()).isTrue();
    }

    @Test
    void requestedPage_returnsPositionsSixToTen() throws Exception {
        List<Integer> created = ownersNamed("Pgsz", 12);

        JsonNode page = list(get("/api/owners").param("lastName", "Pgsz")
                .param("page", "1").param("size", "5"));

        assertThat(ids(page)).containsExactlyElementsOf(created.subList(5, 10));
        assertThat(page.path("totalElements").asLong()).isEqualTo(12);
    }

    @ParameterizedTest
    @ValueSource(ints = {5, 10, 20})
    void allowedPageSizes(int size) throws Exception {
        ownersNamed("Pgsz", 25);

        JsonNode page = list(get("/api/owners").param("lastName", "Pgsz").param("size", "" + size));

        assertThat(page.path("content").size()).isEqualTo(size);
        assertThat(page.path("totalElements").asLong()).isEqualTo(25);
    }

    @ParameterizedTest
    @CsvSource({
            "size, 7",
            "size, 0",
            "size, -5",
            "size, 15",
            "size, 21",
            "size, 100",
            "size, abc",
            "page, -1",
            "page, abc",
            "page, 1.5",
            "page, 99999999999",
            "page, 2147483647",
            "page, 214748365", // x 10 rows overflows the int offset
    })
    void invalidPaging_isBadRequest(String param, String value) throws Exception {
        mockMvc.perform(get("/api/owners").param(param, value))
                .andExpect(status().isBadRequest());
    }

    @ParameterizedTest
    @ValueSource(strings = {"lastName,asc", "telephone,asc", "name", "name,up", "name,asc,city,desc", "NAME,ASC"})
    void unsupportedSort_isBadRequest(String sort) throws Exception {
        mockMvc.perform(get("/api/owners").param("sort", sort))
                .andExpect(status().isBadRequest());
    }

    @ParameterizedTest
    @ValueSource(strings = {"name,asc", "name,desc", "city,asc", "city,desc"})
    void supportedSorts(String sort) throws Exception {
        mockMvc.perform(get("/api/owners").param("sort", sort))
                .andExpect(status().isOk());
    }

    @Test
    void pageBeyondTheLast_isEmptyWithTheActualTotal() throws Exception {
        ownersNamed("Pgsz", 7);

        JsonNode page = list(get("/api/owners").param("lastName", "Pgsz").param("page", "50"));

        assertThat(page.path("content").isEmpty()).isTrue();
        assertThat(page.path("totalElements").asLong()).isEqualTo(7);
    }

    @Test
    void noMatch_isEmptyWithZeroTotal() throws Exception {
        JsonNode page = list(get("/api/owners").param("lastName", "NonExistent"));

        assertThat(page.path("content").isEmpty()).isTrue();
        assertThat(page.path("totalElements").asLong()).isZero();
    }

    @Test
    void emptyLastName_matchesEveryOwner() throws Exception {
        JsonNode page = list(get("/api/owners").param("lastName", ""));

        assertThat(page.path("totalElements").asLong()).isEqualTo(ownerRepository.count());
    }

    @Test
    void lastNameIsACaseSensitivePrefix() throws Exception {
        assertThat(namesMatching("Pot"))
                .containsExactlyInAnyOrder(tuple("Beatrix", "Potter"), tuple("Harry", "Potter"));
        assertThat(namesMatching("otter")).isEmpty();
        assertThat(namesMatching("Harry")).isEmpty();
        assertThat(namesMatching("potter")).isEmpty();
    }

    @Test
    void filteredPage_countsOnlyTheMatches() throws Exception {
        ownersNamed("Pgsz", 7);

        JsonNode page = list(get("/api/owners").param("lastName", "Pgsz")
                .param("size", "5").param("page", "1"));

        assertThat(page.path("content").size()).isEqualTo(2);
        assertThat(page.path("totalElements").asLong()).isEqualTo(7);
    }

    @Test
    void sqlWildcardsInThePrefixAreLiteral() throws Exception {
        owner("Ann", "Wild%card");
        owner("Ann", "Wildxcard");
        owner("Ann", "Wild_one");
        owner("Ann", "Wildzone");

        assertThat(namesMatching("Wild%")).extracting(t -> t.toList().get(1)).containsExactly("Wild%card");
        assertThat(namesMatching("Wild_")).extracting(t -> t.toList().get(1)).containsExactly("Wild_one");
    }

    private List<Tuple> namesMatching(String prefix) throws Exception {
        JsonNode page = list(get("/api/owners").param("lastName", prefix).param("size", "20"));
        return StreamSupport.stream(page.path("content").spliterator(), false)
                .map(o -> tuple(o.path("firstName").asText(), o.path("lastName").asText()))
                .toList();
    }

    /** Owners whose last names sort in creation order: {prefix}a01, {prefix}a02, ... */
    private List<Integer> ownersNamed(String prefix, int count) {
        return IntStream.rangeClosed(1, count)
                .mapToObj(i -> owner("Ann", prefix + "a%02d".formatted(i)))
                .toList();
    }

    private int owner(String firstName, String lastName) {
        Owner owner = TestData.anOwner();
        owner.setFirstName(firstName);
        owner.setLastName(lastName);
        return ownerRepository.save(owner).getId();
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
}
