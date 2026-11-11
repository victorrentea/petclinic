package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.StreamSupport;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import jakarta.transaction.Transactional;
import victor.training.petclinic.DefaultFixture;

/** {@code GET /api/owners} on the 26 seeded owners: paging, sorting and the last-name filter. */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
@DefaultFixture
class OwnerListingTest {
    private static final int SEEDED_OWNERS = 26;

    @Autowired
    MockMvc mockMvc;
    @Autowired
    EntityManager entityManager;
    @Autowired
    EntityManagerFactory entityManagerFactory;

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void defaultFirstPage() throws Exception {
        mockMvc.perform(get("/api/owners"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(10))
                .andExpect(jsonPath("$.content[0].lastName").value("Baskerville"))
                .andExpect(jsonPath("$.totalElements").value(SEEDED_OWNERS))
                .andExpect(jsonPath("$.totalPages").value(3))
                .andExpect(jsonPath("$.number").value(0))
                .andExpect(jsonPath("$.size").value(10));
    }

    @Test
    void lastPartialPage() throws Exception {
        mockMvc.perform(get("/api/owners?page=2&size=10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(6))
                .andExpect(jsonPath("$.number").value(2));
    }

    @Test
    void pagePastTheEnd() throws Exception {
        mockMvc.perform(get("/api/owners?page=7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0))
                .andExpect(jsonPath("$.totalElements").value(SEEDED_OWNERS));
    }

    @Test
    void negativePage_isRefused() throws Exception {
        mockMvc.perform(get("/api/owners?page=-1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0]").isString());
    }

    @Test
    void allowedSize() throws Exception {
        mockMvc.perform(get("/api/owners?size=5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(5))
                .andExpect(jsonPath("$.size").value(5));
    }

    @ParameterizedTest
    @ValueSource(ints = {50, 0, -5, 7})
    void sizeNotAllowed(int size) throws Exception {
        mockMvc.perform(get("/api/owners?size=" + size))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0]").value(allOf(
                        containsString("5"), containsString("10"), containsString("20"))));
    }

    @Test
    void nameSortsByLastNameThenFirstName() throws Exception {
        List<String> names = fullNames(walkAllPages("sort=name,asc", 20));

        assertThat(names.indexOf("Harry Potter")).isEqualTo(names.indexOf("Beatrix Potter") + 1);
    }

    @Test
    void nameDescending_reversesEveryKey() throws Exception {
        List<String> names = fullNames(walkAllPages("sort=name,desc", 20));

        assertThat(names.indexOf("Beatrix Potter")).isEqualTo(names.indexOf("Harry Potter") + 1);
    }

    @Test
    void cityDescending() throws Exception {
        List<JsonNode> owners = walkAllPages("sort=city,desc", 20);

        List<String> asciiCities = owners.stream().map(o -> o.path("city").asText())
                .filter(city -> city.chars().allMatch(c -> c < 128)).toList();
        assertThat(asciiCities).isSortedAccordingTo(Comparator.reverseOrder());
        assertThat(fullNames(owners).stream().filter(londoner()::contains).toList())
                .containsExactly("Newt Scamander", "Sherlock Holmes", "Wendy Darling", "George Darling");
    }

    private static List<String> londoner() {
        return List.of("George Darling", "Wendy Darling", "Sherlock Holmes", "Newt Scamander");
    }

    @Test
    void pagesDoNotOverlap() throws Exception {
        List<Integer> ids = walkAllPages("sort=city", 5).stream().map(o -> o.path("id").asInt()).toList();

        assertThat(ids).hasSize(SEEDED_OWNERS).doesNotHaveDuplicates();
    }

    @ParameterizedTest
    @ValueSource(strings = {"telephone", "address", "pets", "foo", "name,up", "id"})
    void unsortableField_isRefused(String sort) throws Exception {
        mockMvc.perform(get("/api/owners?sort=" + sort))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0]").isString());
    }

    @Test
    void filteredTotal() throws Exception {
        JsonNode page = getJson("/api/owners?lastName=Potter&size=5");

        assertThat(fullNames(content(page))).containsExactly("Beatrix Potter", "Harry Potter");
        assertThat(page.path("totalElements").asInt()).isEqualTo(2);
    }

    @Test
    void nothingMatches() throws Exception {
        mockMvc.perform(get("/api/owners?lastName=Zzz"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void ownersCarryTheirPets() throws Exception {
        mockMvc.perform(get("/api/owners?lastName=McCallister"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].firstName").value("Kevin"))
                .andExpect(jsonPath("$.content[0].pets[0].name").value("Axel"))
                .andExpect(jsonPath("$.content[0].pets[0].type.name").isString())
                .andExpect(jsonPath("$.content[0].pets[0].visits[0].description")
                        .value(containsString("tinsel")));
    }

    @ParameterizedTest
    @ValueSource(ints = {5, 10, 20})
    void queriesGrowPerBatchOf20_notPerOwner(int size) throws Exception {
        String url = "/api/owners?size=" + size;
        int petsOnPage = content(getJson(url)).stream().mapToInt(o -> o.path("pets").size()).sum();

        long queries = queriesToList(url);

        int ownersAndCount = 2;
        assertThat(queries).isEqualTo(ownersAndCount + batchesOf20(size) + batchesOf20(petsOnPage));
    }

    private static int batchesOf20(int keys) {
        return (keys + 19) / 20;
    }

    private long queriesToList(String url) throws Exception {
        entityManager.clear(); // the test transaction would otherwise serve the second call from its cache
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
        statistics.setStatisticsEnabled(true);
        try {
            mockMvc.perform(get(url)).andExpect(status().isOk());
            return statistics.getPrepareStatementCount();
        } finally {
            statistics.setStatisticsEnabled(false);
        }
    }

    private List<JsonNode> walkAllPages(String sortParam, int size) throws Exception {
        List<JsonNode> owners = new ArrayList<>();
        JsonNode page;
        int number = 0;
        do {
            page = getJson("/api/owners?" + sortParam + "&size=" + size + "&page=" + number++);
            owners.addAll(content(page));
        } while (number < page.path("totalPages").asInt());
        return owners;
    }

    private JsonNode getJson(String url) throws Exception {
        String json = mockMvc.perform(get(url)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(json);
    }

    private static List<JsonNode> content(JsonNode page) {
        return StreamSupport.stream(page.path("content").spliterator(), false).toList();
    }

    private static List<String> fullNames(List<JsonNode> owners) {
        return owners.stream()
                .map(o -> o.path("firstName").asText() + " " + o.path("lastName").asText())
                .toList();
    }
}
