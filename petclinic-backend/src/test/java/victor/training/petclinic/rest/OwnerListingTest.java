package victor.training.petclinic.rest;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;

import org.assertj.core.api.Assertions;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.persistence.EntityManagerFactory;

/** #25: {@code GET /api/owners} answers one page, in a chosen order, filtered by last name. */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
class OwnerListingTest {

    @Autowired
    MockMvc mockMvc;
    @Autowired
    JdbcTemplate jdbc;
    @Autowired
    EntityManagerFactory entityManagerFactory;

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void withNoParametersAnswersTheFirstTenSortedByName() throws Exception {
        givenNumberedOwners(28);

        list("").andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(10)))
                .andExpect(jsonPath("$.content[0].firstName").value("Owner01"))
                .andExpect(jsonPath("$.totalElements").value(28))
                .andExpect(jsonPath("$.totalPages").value(3))
                .andExpect(jsonPath("$.number").value(0))
                .andExpect(jsonPath("$.size").value(10));
    }

    @Test
    void answersALaterPage() throws Exception {
        givenNumberedOwners(28);

        list("?page=2&size=10").andExpect(jsonPath("$.content", hasSize(8)))
                .andExpect(jsonPath("$.content[0].firstName").value("Owner21"))
                .andExpect(jsonPath("$.number").value(2));
    }

    @Test
    void aPagePastTheEndIsEmptyWithCorrectTotals() throws Exception {
        givenNumberedOwners(28);

        list("?page=50").andExpect(status().isOk())
                .andExpect(jsonPath("$.content", empty()))
                .andExpect(jsonPath("$.totalElements").value(28))
                .andExpect(jsonPath("$.totalPages").value(3));
    }

    @ParameterizedTest
    @ValueSource(ints = {5, 10, 20})
    void acceptsAllowedPageSizes(int size) throws Exception {
        givenNumberedOwners(28);

        list("?size=" + size).andExpect(status().isOk()).andExpect(jsonPath("$.content", hasSize(size)));
    }

    @ParameterizedTest
    @ValueSource(strings = {"?size=1000", "?size=0", "?size=abc", "?page=-1", "?page=abc", "?sort=telephone,asc",
            "?sort=address,asc", "?sort=pets,asc", "?sort=name,sideways", "?sort=name", "?sort=,"})
    void refusesInvalidParameters(String query) throws Exception {
        givenNumberedOwners(1);

        list(query).andExpect(status().isBadRequest()).andExpect(jsonPath("$.title").exists());
    }

    @Test
    void sortsByNameFirstNameThenLastName() throws Exception {
        givenOwner("Ada", "Lovelace", "London");
        givenOwner("Ada", "Byron", "London");
        givenOwner("Zoe", "Abbott", "London");

        list("?sort=name,asc").andExpect(jsonPath("$.content[*].lastName", contains("Byron", "Lovelace", "Abbott")));
        list("?sort=name,desc").andExpect(jsonPath("$.content[*].lastName", contains("Abbott", "Lovelace", "Byron")));
    }

    @Test
    void sortsLettersWithDiacriticsNextToTheirBaseLetter() throws Exception {
        givenOwner("Tom", "Riddle", "London");
        givenOwner("Ștefan", "Mureșan", "Vienna");
        givenOwner("Sam", "Carraclough", "Yorkshire");

        list("?sort=name,asc").andExpect(jsonPath("$.content[*].firstName", contains("Sam", "Ștefan", "Tom")));
    }

    @Test
    void sortsByCityBreakingTiesByName() throws Exception {
        givenOwner("Zoe", "Abbott", "London");
        givenOwner("Ada", "Byron", "London");
        givenOwner("Sigmund", "Freud", "Vienna");
        givenOwner("Ludwig", "Beethoven", "Kraków");

        list("?sort=city,asc")
                .andExpect(jsonPath("$.content[*].firstName", contains("Ludwig", "Ada", "Zoe", "Sigmund")));
        list("?sort=city,desc")
                .andExpect(jsonPath("$.content[*].firstName", contains("Sigmund", "Zoe", "Ada", "Ludwig")));
    }

    @Test
    void walkingEveryPageMeetsEachOwnerOnceEvenWithIdenticalNames() throws Exception {
        for (int i = 0; i < 12; i++) {
            givenOwner("Ada", "Byron", "London");
        }

        List<Integer> seen = new ArrayList<>();
        for (int page = 0; page < 3; page++) {
            seen.addAll(idsOf(list("?size=5&page=" + page)));
        }

        Assertions.assertThat(seen).hasSize(12).doesNotHaveDuplicates();
    }

    @Test
    void aFullPageRunsTheSameNumberOfQueriesAsASmallOne() throws Exception {
        givenNumberedOwners(20);
        givenEveryOwnerHasAPetWithAVisit();

        Assertions.assertThat(queriesFor("?size=20")).isEqualTo(queriesFor("?size=5"));
    }

    @Test
    void aRowCarriesOnlyWhatTheGridDisplays() throws Exception {
        givenOwner("Ada", "Byron", "London");
        givenEveryOwnerHasAPetWithAVisit();

        list("").andExpect(jsonPath("$.content[0].pets[0].name").value("Rex"))
                .andExpect(jsonPath("$.content[0].pets[0].type").value("cat"))
                .andExpect(jsonPath("$.content[0].pets[0].visits").doesNotExist())
                .andExpect(jsonPath("$.content[0].pets[0].birthDate").doesNotExist())
                .andExpect(jsonPath("$.content[0].pets[0].id").doesNotExist());
    }

    @Test
    void aPageNeverQueriesVisits() throws Exception {
        givenNumberedOwners(28);
        givenEveryOwnerHasAPetWithAVisit();

        Assertions.assertThat(queriesFor("?size=20")).as("owners, their count, pets").isEqualTo(3);
    }

    @Test
    void searchMatchesTheStartOfTheLastNameAndCountsOnlyMatches() throws Exception {
        givenTheSearchableOwners();

        list("?lastName=Pot").andExpect(jsonPath("$.content[*].firstName", contains("Beatrix", "Harry")))
                .andExpect(jsonPath("$.totalElements").value(2));
        list("?lastName=otter").andExpect(jsonPath("$.content", empty()))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void searchDoesNotLookInsideALastName() throws Exception {
        givenTheSearchableOwners();

        list("?lastName=Garcia").andExpect(jsonPath("$.content", empty()));
    }

    @ParameterizedTest
    @ValueSource(strings = {"?lastName=", ""})
    void aBlankSearchPagesThroughEveryOwner(String query) throws Exception {
        givenTheSearchableOwners();

        list(query).andExpect(jsonPath("$.totalElements").value(5));
    }

    @Test
    void searchIgnoresCase() throws Exception {
        givenTheSearchableOwners();

        list("?lastName=potter").andExpect(jsonPath("$.totalElements").value(2));
    }

    @ParameterizedTest
    @ValueSource(strings = {"Mures", "Mureșan", "MUREȘ", "mures"})
    void searchIgnoresDiacritics(String search) throws Exception {
        givenTheSearchableOwners();

        list("?lastName=" + search).andExpect(jsonPath("$.content[*].firstName", contains("Ștefan")));
    }

    @Test
    void searchFindsALastNameStartingWithALetterWithAccent() throws Exception {
        givenTheSearchableOwners();

        list("?lastName=sli").andExpect(jsonPath("$.content[*].firstName", contains("Łukasz")));
    }

    @ParameterizedTest
    @ValueSource(strings = {"%", "_", "Pot%", "Po_ter", "\\"})
    void searchTreatsWildcardsAsPlainCharacters(String search) throws Exception {
        givenTheSearchableOwners();

        searchFor(search).andExpect(jsonPath("$.content", empty()));
    }

    @Test
    void searchFindsALiteralPercentSign() throws Exception {
        givenOwner("Ada", "%Odd", "London");
        givenOwner("Sam", "Normal", "London");

        searchFor("%").andExpect(jsonPath("$.content[*].firstName", contains("Ada")));
    }

    @Test
    void searchCombinesWithPagingAndSorting() throws Exception {
        givenTheSearchableOwners();

        list("?lastName=Potter&size=5&sort=name,desc&page=0")
                .andExpect(jsonPath("$.content[*].firstName", contains("Harry", "Beatrix")));
    }

    private void givenEveryOwnerHasAPetWithAVisit() {
        jdbc.update("""
                INSERT INTO pets (name, birth_date, type_id, owner_id)
                SELECT 'Rex', DATE '2020-01-01', 1, id FROM owners""");
        jdbc.update("""
                INSERT INTO visits (pet_id, visit_date, description)
                SELECT id, DATE '2024-01-01', 'checkup' FROM pets""");
    }

    private void givenTheSearchableOwners() {
        givenOwner("Harry", "Potter", "Little Whinging");
        givenOwner("Beatrix", "Potter", "Near Sawrey");
        givenOwner("Ștefan", "Mureșan", "Vienna");
        givenOwner("Łukasz", "Śliwiński", "Kraków");
        givenOwner("Juan Carlos", "Martín García Lorca", "Madrid");
    }

    private void givenNumberedOwners(int count) {
        IntStream.rangeClosed(1, count).forEach(i -> givenOwner("Owner%02d".formatted(i), "Numbered", "London"));
    }

    private void givenOwner(String firstName, String lastName, String city) {
        jdbc.update("INSERT INTO owners (first_name, last_name, address, city, telephone) VALUES (?, ?, 'a', ?, '1')",
                firstName, lastName, city);
    }

    private ResultActions searchFor(String lastName) throws Exception {
        return mockMvc.perform(get("/api/owners").param("lastName", lastName));
    }

    private ResultActions list(String query) throws Exception {
        return mockMvc.perform(get("/api/owners" + query));
    }

    private List<Integer> idsOf(ResultActions result) throws Exception {
        JsonNode page = mapper.readTree(result.andReturn().getResponse().getContentAsString());
        List<Integer> ids = new ArrayList<>();
        page.path("content").forEach(owner -> ids.add(owner.path("id").asInt()));
        return ids;
    }

    private long queriesFor(String query) throws Exception {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.setStatisticsEnabled(true);
        statistics.clear();
        list(query).andExpect(status().isOk());
        return statistics.getPrepareStatementCount();
    }
}
