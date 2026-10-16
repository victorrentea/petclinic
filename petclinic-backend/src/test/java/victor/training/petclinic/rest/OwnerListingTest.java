package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;
import java.util.stream.StreamSupport;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;

/**
 * Runs on the 26 seeded owners only: the database is reset first, because some tests commit owners
 * (e.g. PetTypeTest#deletePetType_inUse_returnsConflict). Sort orders are asserted on ASCII names,
 * as the test database's collation follows the OS locale.
 */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY,
        refresh = AutoConfigureEmbeddedDatabase.RefreshMode.BEFORE_CLASS)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerListingTest {
    private static final int SEEDED_OWNERS = 26;

    @Autowired
    MockMvc mockMvc;

    @Autowired
    EntityManager entityManager;

    final ObjectMapper mapper = new ObjectMapper();

    @Test
    void firstPageByDefault_tenOwnersInFirstNameOrder_withTotal() throws Exception {
        JsonNode page = list("");

        assertThat(page.get("totalElements").asLong()).isEqualTo(SEEDED_OWNERS);
        assertThat(firstNames(page)).containsExactly(
                "Alice", "Alonso", "Argus", "Beatrix", "Charles",
                "Erwin", "George", "Harry", "Henry", "Hermione");
    }

    @Test
    void chosenPageAndSize() throws Exception {
        JsonNode page = list("page=1&size=5");

        assertThat(page.get("totalElements").asLong()).isEqualTo(SEEDED_OWNERS);
        assertThat(firstNames(page)).containsExactly("Erwin", "George", "Harry", "Henry", "Hermione");
    }

    @Test
    void sortByNameDescending() throws Exception {
        assertThat(firstNames(list("lastName=Darling&sort=name,desc"))).containsExactly("Wendy", "George");
    }

    @Test
    void sortByNameAscending_thenByLastName() throws Exception {
        assertThat(firstNames(list("lastName=Potter&sort=name,asc"))).containsExactly("Beatrix", "Harry");
    }

    @Test
    void sortByCityAscending() throws Exception {
        assertThat(field(list("size=5&sort=city,asc"), "city"))
                .containsExactly("Bristol", "Brussels", "Dartmoor", "Florence", "Higham");
    }

    @Test
    void sortByCityDescending() throws Exception {
        assertThat(field(list("size=5&sort=city,desc"), "city"))
                .containsExactly("Yorkshire", "Winnetka", "Wiltshire", "Wigan", "Vienna");
    }

    @Test
    void walkingAllPagesByCity_returnsEveryOwnerExactlyOnce() throws Exception {
        List<Integer> ids = new ArrayList<>();
        for (int page = 0; page < 6; page++) {
            ids.addAll(field(list("size=5&sort=city,asc&page=" + page), "id").stream().map(Integer::valueOf).toList());
        }

        assertThat(ids).containsExactlyInAnyOrderElementsOf(IntStream.rangeClosed(1, SEEDED_OWNERS).boxed().toList());
        assertThat(ids).as("Londoners, tied on city, in id order").containsSubsequence(6, 7, 11, 17, 26);
    }

    @Test
    void pagePastTheEnd_isEmpty_withTheRealTotal() throws Exception {
        JsonNode page = list("page=100");

        assertThat(page.get("content")).isEmpty();
        assertThat(page.get("totalElements").asLong()).isEqualTo(SEEDED_OWNERS);
    }

    @ParameterizedTest
    @CsvSource({
            "size=10000, size",
            "size=7, size",
            "page=-1, page",
            "'sort=telephone,asc', sort",
            "'sort=name,up', sort",
            "sort=name, sort",
            "size=abc, size",
            "page=x, page",
    })
    void badPagingParameter_isRejectedNamingIt(String query, String parameter) throws Exception {
        mockMvc.perform(get("/api/owners?" + query))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.detail", startsWith(parameter + " ")))
                .andExpect(jsonPath("$.content").doesNotExist());
    }

    @Test
    void filterByLastName_pagesAndCountsOnlyTheMatches() throws Exception {
        JsonNode page = list("lastName=Potter&size=5");

        assertThat(page.get("totalElements").asLong()).isEqualTo(2);
        assertThat(field(page, "lastName")).containsOnly("Potter").hasSize(2);
    }

    @Test
    void onePage_costsOneQueryEachForPageCountPetsAndVisits() throws Exception {
        assertThat(statementsToList("size=5")).isEqualTo(4); // page, count, pets, visits
    }

    @Test
    void aPageOf20_loadsVisitsIn20PetBatches() throws Exception {
        JsonNode[] page = new JsonNode[1];
        long statements = statementsDuring(() -> page[0] = list("size=20"));

        long petsOnPage = StreamSupport.stream(page[0].get("content").spliterator(), false)
                .mapToInt(owner -> owner.get("pets").size()).sum();
        long visitBatches = (petsOnPage + 19) / 20;
        assertThat(statements).isEqualTo(3 + visitBatches); // page, count, pets, visits per 20 pets
    }

    private long statementsToList(String query) throws Exception {
        return statementsDuring(() -> list(query));
    }

    private long statementsDuring(ThrowingRunnable call) throws Exception {
        entityManager.clear();
        Statistics statistics = entityManager.getEntityManagerFactory().unwrap(SessionFactory.class).getStatistics();
        statistics.setStatisticsEnabled(true);
        statistics.clear();
        try {
            call.run();
            return statistics.getPrepareStatementCount();
        } finally {
            statistics.setStatisticsEnabled(false);
        }
    }

    private interface ThrowingRunnable {
        void run() throws Exception;
    }

    private JsonNode list(String query) throws Exception {
        String json = mockMvc.perform(get("/api/owners?" + query))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(json);
    }

    private static List<String> firstNames(JsonNode page) {
        return field(page, "firstName");
    }

    private static List<String> field(JsonNode page, String name) {
        return StreamSupport.stream(page.get("content").spliterator(), false)
                .map(owner -> owner.get(name).asText())
                .toList();
    }
}
